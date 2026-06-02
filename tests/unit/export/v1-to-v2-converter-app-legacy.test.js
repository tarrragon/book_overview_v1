/**
 * APP legacy 無損匯入分支單元測試（0.19.0-W4-031.2.2）
 *
 * 測試範圍：
 * - convertAppLegacyToV2Book：單本無損轉換（readingStatus 不重推、coverImageUrl→cover、
 *   多值→_passthrough、importance/ccl carry、未知欄位保留、id 保留）
 * - convertAppLegacyToV2Data：wrapper 提取 + 逐本轉換 + dedup
 * - dedupBooks：id 主鍵 + crossPlatformId/dataFingerprint 軟連結（spec §8 C5）
 * - APP→Ext→APP round-trip（止血核心）：經 mapV1BookToCanonical 重建後不丟 tags/readingStatus/多值
 *
 * 測試策略（Sociable Unit）：零 mock，純函式輸入輸出直接斷言；無計時斷言。
 * 權威 SSOT：docs/spec/book-interchange-v1.md v3.0.0（§7/§8/§9/§11）。
 */

'use strict'

const {
  convertAppLegacyToV2Book,
  convertAppLegacyToV2Data,
  dedupBooks
} = require('../../../src/export/v1-to-v2-converter')
const {
  mapV1BookToCanonical
} = require('../../../src/export/book-interchange-v1-adapter')
const { BookValidationError } = require('../../../src/core/errors/BookValidationError')

// APP legacy fixed-field book（v0.31.x）：多值欄位、importance/ccl、canonical 命名 readingStatus
function makeAppLegacyBook (overrides = {}) {
  return {
    id: 'book_1700000000',
    title: '挪威的森林',
    authors: ['村上春樹', 'Haruki Murakami'],
    publisher: '時報出版',
    source: 'readmoo',
    isbn: '9789571234567',
    coverImageUrl: 'https://example.com/cover-full.jpg',
    readingStatus: 'reading', // canonical/V1 共用命名
    progress: 45.5,
    importanceLevel: 4,
    ccl: { id: 'ccl-861', name: '日本文學', path: '語言文學/東方文學/日本文學' },
    tagIds: ['c2'],
    createdAt: '2026-01-15T08:30:00.000Z',
    updatedAt: '2026-03-20T14:22:00.000Z',
    ...overrides
  }
}

function makeBackupWrapper (books) {
  return {
    backup_info: { app: 'book_overview_app', version: '1.0.0' },
    books
  }
}

describe('convertAppLegacyToV2Book — 單本無損轉換', () => {
  test('缺 id 或 title → throw BookValidationError', () => {
    expect(() => convertAppLegacyToV2Book({ title: 'x' })).toThrow(BookValidationError)
    expect(() => convertAppLegacyToV2Book({ id: 'x' })).toThrow(BookValidationError)
    expect(() => convertAppLegacyToV2Book(null)).toThrow(BookValidationError)
    expect(() => convertAppLegacyToV2Book([])).toThrow(BookValidationError)
  })

  test('id 保留禁重生（spec §8 D5）', () => {
    const v2 = convertAppLegacyToV2Book(makeAppLegacyBook())
    expect(v2.id).toBe('book_1700000000')
  })

  test('coverImageUrl → cover（spec §11）', () => {
    const v2 = convertAppLegacyToV2Book(makeAppLegacyBook())
    expect(v2.cover).toBe('https://example.com/cover-full.jpg')
  })

  test('cover 欄位（非 coverImageUrl）亦相容', () => {
    const v2 = convertAppLegacyToV2Book(
      makeAppLegacyBook({ coverImageUrl: undefined, cover: 'https://x/c.jpg' })
    )
    expect(v2.cover).toBe('https://x/c.jpg')
  })

  test('readingStatus 不重推：carry APP 原值（V1 命名直用）', () => {
    const v2 = convertAppLegacyToV2Book(makeAppLegacyBook({ readingStatus: 'reading', progress: 0 }))
    // 不依 progress 衍生狀態（progress=0 也保持 reading）
    expect(v2.readingStatus).toBe('reading')
  })

  test('readingStatus canonical 命名（not_started）逆正規化為 V1（unread，§7）', () => {
    const v2 = convertAppLegacyToV2Book(makeAppLegacyBook({ readingStatus: 'not_started' }))
    expect(v2.readingStatus).toBe('unread')
  })

  test('readingStatus 未知態記 _passthrough.readingStatusRaw，不臆造（C1）', () => {
    const v2 = convertAppLegacyToV2Book(makeAppLegacyBook({ readingStatus: 'future_state' }))
    expect(v2.readingStatus).toBeUndefined()
    expect(v2._passthrough.readingStatusRaw).toBe('future_state')
  })

  test('readingStatus 缺值 → 不設、不臆造', () => {
    const v2 = convertAppLegacyToV2Book(makeAppLegacyBook({ readingStatus: undefined }))
    expect(v2.readingStatus).toBeUndefined()
  })

  test('authors[] 多值全保留', () => {
    const v2 = convertAppLegacyToV2Book(makeAppLegacyBook())
    expect(v2.authors).toEqual(['村上春樹', 'Haruki Murakami'])
  })

  test('author 單值（無 authors[]）→ 包陣列', () => {
    const v2 = convertAppLegacyToV2Book(
      makeAppLegacyBook({ authors: undefined, author: '東野圭吾' })
    )
    expect(v2.authors).toEqual(['東野圭吾'])
  })

  test('多值 publisher → 首值入固定欄位，完整陣列入 _passthrough.tags.publisher（C1）', () => {
    const v2 = convertAppLegacyToV2Book(
      makeAppLegacyBook({ publisher: ['時報出版', '新經典文化'] })
    )
    expect(v2.publisher).toBe('時報出版')
    expect(v2._passthrough.tags.publisher).toHaveLength(2)
    expect(v2._passthrough.tags.publisher.map(n => n.name)).toEqual(['時報出版', '新經典文化'])
  })

  test('isbn 收斂 identifiers.isbn，多值入 _passthrough.tags.isbn', () => {
    const v2 = convertAppLegacyToV2Book(
      makeAppLegacyBook({ isbn: ['9789571234567', '9789571299999'] })
    )
    expect(v2.identifiers.isbn).toBe('9789571234567')
    expect(v2._passthrough.tags.isbn).toHaveLength(2)
  })

  test('importanceLevel(1-7) → imp-N tag carry 入 _passthrough.tags.importance（spec §5.1）', () => {
    const v2 = convertAppLegacyToV2Book(makeAppLegacyBook({ importanceLevel: 4 }))
    expect(v2._passthrough.tags.importance).toEqual([{ id: 'imp-4', name: 'imp-4' }])
  })

  test('ccl 物件 carry 入 _passthrough.tags.ccl（含 path）', () => {
    const v2 = convertAppLegacyToV2Book(makeAppLegacyBook())
    expect(v2._passthrough.tags.ccl).toEqual([
      { id: 'ccl-861', name: '日本文學', path: '語言文學/東方文學/日本文學' }
    ])
  })

  test('tagIds → 內部 v2 tagIds 圖', () => {
    const v2 = convertAppLegacyToV2Book(makeAppLegacyBook({ tagIds: ['c2', 'c5'] }))
    expect(v2.tagIds).toEqual(['c2', 'c5'])
  })

  test('tags.custom（everything-as-tags）→ tagIds（無 tagIds 時）', () => {
    const v2 = convertAppLegacyToV2Book(
      makeAppLegacyBook({
        tagIds: undefined,
        tags: { custom: [{ id: 'c9', name: '送同事' }] }
      })
    )
    expect(v2.tagIds).toEqual(['c9'])
  })

  test('未知頂層欄位保留入 _passthrough（spec §9，禁 strip）', () => {
    const v2 = convertAppLegacyToV2Book(
      makeAppLegacyBook({ apiEnriched: true, mysteryField: { x: 1 } })
    )
    expect(v2._passthrough.apiEnriched).toBe(true)
    expect(v2._passthrough.mysteryField).toEqual({ x: 1 })
  })

  test('activeLoan / crossPlatformId / dataFingerprint carry', () => {
    const v2 = convertAppLegacyToV2Book(
      makeAppLegacyBook({
        activeLoan: { dueDate: '2026-04-01' },
        crossPlatformId: 'cpid_abc',
        dataFingerprint: 'fp_xyz'
      })
    )
    expect(v2._passthrough.activeLoan).toEqual({ dueDate: '2026-04-01' })
    expect(v2._passthrough.crossPlatformId).toBe('cpid_abc')
    expect(v2._passthrough.dataFingerprint).toBe('fp_xyz')
  })
})

describe('convertAppLegacyToV2Data — wrapper 提取 + dedup', () => {
  test('backup_info wrapper：提取 books 並逐本轉換', () => {
    const result = convertAppLegacyToV2Data(makeBackupWrapper([makeAppLegacyBook()]))
    expect(result.books).toHaveLength(1)
    expect(result.metadata.source).toBe('book_overview_app')
    expect(result.metadata.totalBooks).toBe(1)
    expect(result.tagCategories).toEqual([])
    expect(result.tags).toEqual([])
  })

  test('裸 books 陣列亦可', () => {
    const result = convertAppLegacyToV2Data([makeAppLegacyBook()])
    expect(result.books).toHaveLength(1)
  })

  test('缺 id/title 的書籍跳過（不中斷整批）', () => {
    const result = convertAppLegacyToV2Data(
      makeBackupWrapper([makeAppLegacyBook(), { title: '無 id' }])
    )
    expect(result.books).toHaveLength(1)
  })

  test('dedup：相同 id 保留首見', () => {
    const result = convertAppLegacyToV2Data(
      makeBackupWrapper([
        makeAppLegacyBook({ id: 'dup', title: 'A' }),
        makeAppLegacyBook({ id: 'dup', title: 'B' })
      ])
    )
    expect(result.books).toHaveLength(1)
    expect(result.books[0].title).toBe('A')
  })
})

describe('dedupBooks — id 主鍵 + 軟連結（spec §8 C5）', () => {
  test('id 主鍵命中 → 去重', () => {
    const out = dedupBooks([
      { id: 'x', title: 'A' },
      { id: 'x', title: 'B' },
      { id: 'y', title: 'C' }
    ])
    expect(out.map(b => b.id)).toEqual(['x', 'y'])
  })

  test('crossPlatformId 軟連結命中（不同 id）→ 去重', () => {
    const out = dedupBooks([
      { id: 'a', title: 'A', _passthrough: { crossPlatformId: 'cpid_1' } },
      { id: 'b', title: 'B', _passthrough: { crossPlatformId: 'cpid_1' } }
    ])
    expect(out).toHaveLength(1)
    expect(out[0].id).toBe('a')
  })

  test('dataFingerprint 軟連結命中 → 去重', () => {
    const out = dedupBooks([
      { id: 'a', title: 'A', dataFingerprint: 'fp_1' },
      { id: 'b', title: 'B', dataFingerprint: 'fp_1' }
    ])
    expect(out).toHaveLength(1)
  })

  test('軟連結不取代 id：無軟連結時純依 id', () => {
    const out = dedupBooks([
      { id: 'a', title: 'A' },
      { id: 'b', title: 'B' }
    ])
    expect(out).toHaveLength(2)
  })
})

describe('APP→Ext→APP round-trip 止血（C1，不丟 tags/readingStatus/多值）', () => {
  test('readingStatus 經內部 v2 後 write 回 canonical 還原（reading）', () => {
    const v2 = convertAppLegacyToV2Book(makeAppLegacyBook({ readingStatus: 'reading' }))
    const canonical = mapV1BookToCanonical(v2)
    expect(canonical.tags.readingStatus[0].name).toBe('reading')
  })

  test('多值 publisher 經 _passthrough write 回 canonical 完整還原', () => {
    const v2 = convertAppLegacyToV2Book(
      makeAppLegacyBook({ publisher: ['時報出版', '新經典文化'] })
    )
    const canonical = mapV1BookToCanonical(v2)
    expect(canonical.tags.publisher.map(n => n.name)).toEqual(['時報出版', '新經典文化'])
  })

  test('importance / ccl 經 _passthrough write 回 canonical 還原（不丟失）', () => {
    const v2 = convertAppLegacyToV2Book(makeAppLegacyBook())
    const canonical = mapV1BookToCanonical(v2)
    expect(canonical.tags.importance).toEqual([{ id: 'imp-4', name: 'imp-4' }])
    expect(canonical.tags.ccl).toEqual([
      { id: 'ccl-861', name: '日本文學', path: '語言文學/東方文學/日本文學' }
    ])
  })

  test('authors 多值 round-trip 完整還原', () => {
    const v2 = convertAppLegacyToV2Book(makeAppLegacyBook())
    const canonical = mapV1BookToCanonical(v2)
    expect(canonical.tags.author.map(n => n.name)).toEqual(['村上春樹', 'Haruki Murakami'])
  })

  test('id 全程保留禁重生', () => {
    const v2 = convertAppLegacyToV2Book(makeAppLegacyBook())
    const canonical = mapV1BookToCanonical(v2)
    expect(canonical.id).toBe('book_1700000000')
  })
})
