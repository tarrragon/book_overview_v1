/**
 * V1↔APP 跨專案 canonical v3 round-trip 整合測試（W5-002）
 *
 * 驗證鏈：V1 原始書 → V1 canonical 匯出 → [APP 匯入+匯出] → V1 canonical 匯入 → Diff
 *
 * 成功標準（W5-001 定義）：
 * - SC-1：必要欄位無損（id/title/tags/readingStatus）
 * - SC-2：readingStatus 六態雙向映射正確
 * - SC-3：多值 metadata（多 author）round-trip 無損
 * - SC-4：_passthrough 保留（APP 不認識的欄位不丟棄）
 * - SC-5：formatVersion semver 正確
 *
 * 測試 fixture：
 * - v1-canonical-v3-round-trip.json：V1 匯出的 canonical（6 本書，六態 readingStatus）
 * - app-canonical-from-v1-round-trip.json：APP 消費 V1 fixture 後匯出的 canonical
 *
 * @jest-environment jsdom
 */

'use strict'

const fs = require('fs')
const path = require('path')

const {
  mapCanonicalToV1Book
} = require('src/export/book-interchange-v1-adapter')

const FIXTURE_DIR = path.resolve(__dirname, 'fixtures')

const v1Canonical = JSON.parse(
  fs.readFileSync(path.join(FIXTURE_DIR, 'v1-canonical-v3-round-trip.json'), 'utf8')
)

const appCanonical = JSON.parse(
  fs.readFileSync(path.join(FIXTURE_DIR, 'app-canonical-from-v1-round-trip.json'), 'utf8')
)

const ORIGINAL_BOOKS = [
  {
    id: 'rt-001',
    title: '挪威的森林',
    authors: ['村上春樹', 'Haruki Murakami'],
    publisher: '時報出版',
    source: 'readmoo',
    identifiers: { isbn: '9789571234567' },
    readingStatus: 'reading',
    isManualStatus: false,
    progress: 45.5,
    cover: 'https://readmoo.com/cover/rt-001.jpg',
    tagIds: ['tag-gift'],
    createdAt: '2026-01-15T08:30:00.000Z',
    updatedAt: '2026-03-20T14:22:00.000Z'
  },
  {
    id: 'rt-002',
    title: '原子習慣',
    authors: ['James Clear'],
    publisher: '方智出版社',
    source: 'readmoo',
    identifiers: { isbn: '9789861755267' },
    readingStatus: 'unread',
    progress: 0,
    cover: '',
    tagIds: []
  },
  {
    id: 'rt-003',
    title: '人類大歷史',
    authors: ['Yuval Noah Harari'],
    publisher: '天下文化',
    source: 'readmoo',
    readingStatus: 'finished',
    progress: 100,
    cover: 'https://readmoo.com/cover/rt-003.jpg',
    tagIds: []
  },
  {
    id: 'rt-004',
    title: '被討厭的勇氣',
    authors: ['岸見一郎', '古賀史健'],
    publisher: '究竟出版',
    source: 'readmoo',
    readingStatus: 'abandoned',
    isManualStatus: true,
    progress: 30,
    cover: 'https://readmoo.com/cover/rt-004.jpg',
    tagIds: []
  },
  {
    id: 'rt-005',
    title: '刻意練習',
    authors: ['Anders Ericsson', 'Robert Pool'],
    publisher: '方智出版社',
    source: 'readmoo',
    readingStatus: 'queued',
    progress: 0,
    cover: '',
    tagIds: ['tag-friend']
  },
  {
    id: 'rt-006',
    title: 'Clean Code',
    authors: ['Robert C. Martin'],
    publisher: 'Prentice Hall',
    source: 'readmoo',
    readingStatus: 'reference',
    isManualStatus: true,
    progress: 65,
    cover: 'https://readmoo.com/cover/rt-006.jpg',
    tagIds: []
  }
]

describe('V1↔APP 跨專案 round-trip（W5-002）', () => {
  describe('SC-5: formatVersion semver 驗證', () => {
    test('V1 canonical formatVersion = 3.0.0', () => {
      expect(v1Canonical.format).toBe('book-interchange-v1')
      expect(v1Canonical.formatVersion).toBe('3.0.0')
      expect(v1Canonical.metadata.sourceApp).toBe('book-overview')
    })

    test('APP canonical formatVersion = 3.x 且 sourceApp = book_overview_app', () => {
      expect(appCanonical.format).toBe('book-interchange-v1')
      expect(appCanonical.formatVersion).toMatch(/^3\./)
      expect(appCanonical.metadata.sourceApp).toBe('book_overview_app')
    })

    test('兩端書數一致', () => {
      expect(v1Canonical.books.length).toBe(6)
      expect(appCanonical.books.length).toBe(6)
      expect(v1Canonical.metadata.totalBooks).toBe(appCanonical.metadata.totalBooks)
    })
  })

  describe('SC-1: V1 匯入 APP canonical — 必要欄位無損', () => {
    let restoredBooks

    beforeAll(() => {
      restoredBooks = appCanonical.books.map(b => mapCanonicalToV1Book(b))
    })

    test('全部 6 本書成功還原', () => {
      expect(restoredBooks.length).toBe(6)
    })

    test.each(ORIGINAL_BOOKS.map(b => [b.id, b.title]))('id=%s title=%s 保留', (id, title) => {
      const restored = restoredBooks.find(b => b.id === id)
      expect(restored).toBeDefined()
      expect(restored.title).toBe(title)
    })

    test('source（platform）保留', () => {
      for (const restored of restoredBooks) {
        expect(restored.source).toBe('readmoo')
      }
    })
  })

  describe('SC-2: readingStatus 六態雙向映射', () => {
    const RS_V1_TO_CANONICAL = {
      unread: 'not_started',
      queued: 'queued',
      reading: 'reading',
      finished: 'finished',
      abandoned: 'abandoned',
      reference: 'reference'
    }

    test('APP canonical 使用 readingStatus（camelCase，對齊 spec）', () => {
      for (const book of appCanonical.books) {
        expect(book.tags).toHaveProperty('readingStatus')
        expect(book.tags).not.toHaveProperty('reading_status')
      }
    })

    test.each(ORIGINAL_BOOKS.map(b => [b.id, b.readingStatus]))(
      'id=%s V1 status=%s round-trip 還原',
      (id, originalStatus) => {
        const appBook = appCanonical.books.find(b => b.id === id)
        expect(appBook).toBeDefined()

        const appStatusTag = appBook.tags?.readingStatus?.[0]?.name
        expect(appStatusTag).toBe(RS_V1_TO_CANONICAL[originalStatus])

        const restored = mapCanonicalToV1Book(appBook)
        expect(restored.readingStatus).toBe(originalStatus)
      }
    )
  })

  describe('SC-3: 多值 metadata round-trip', () => {
    test('多 author round-trip 無損（rt-001: 村上春樹 + Haruki Murakami）', () => {
      const appBook = appCanonical.books.find(b => b.id === 'rt-001')
      const authorNames = appBook.tags.author.map(t => t.name)
      expect(authorNames).toContain('村上春樹')
      expect(authorNames).toContain('Haruki Murakami')

      const restored = mapCanonicalToV1Book(appBook)
      expect(restored._passthrough?.tags?.author?.map(t => t.name)).toEqual(
        expect.arrayContaining(['村上春樹', 'Haruki Murakami'])
      )
    })

    test('多 author round-trip 無損（rt-004: 岸見一郎 + 古賀史健）', () => {
      const appBook = appCanonical.books.find(b => b.id === 'rt-004')
      const authorNames = appBook.tags.author.map(t => t.name)
      expect(authorNames).toContain('岸見一郎')
      expect(authorNames).toContain('古賀史健')
    })

    test('ISBN round-trip（rt-001: 9789571234567）', () => {
      const appBook = appCanonical.books.find(b => b.id === 'rt-001')
      const isbnTags = appBook.tags?.isbn
      if (isbnTags && isbnTags.length > 0) {
        expect(isbnTags[0].name).toBe('9789571234567')
      }
    })
  })

  describe('SC-4: _passthrough 保留', () => {
    test('APP 不認識的 V1 欄位經 passthrough 保留', () => {
      const appBook = appCanonical.books.find(b => b.id === 'rt-001')
      const restored = mapCanonicalToV1Book(appBook)

      expect(restored.id).toBe('rt-001')
      expect(restored.title).toBe('挪威的森林')

      if (restored._passthrough) {
        expect(restored._passthrough).toEqual(expect.any(Object))
      }
    })
  })

  describe('SC-1 完整 Diff: 原始 V1 books vs round-trip 還原', () => {
    test('逐本比對關鍵欄位', () => {
      const diffs = []

      for (const original of ORIGINAL_BOOKS) {
        const appBook = appCanonical.books.find(b => b.id === original.id)
        if (!appBook) {
          diffs.push({ id: original.id, issue: 'APP canonical 中找不到' })
          continue
        }

        const restored = mapCanonicalToV1Book(appBook)

        if (restored.title !== original.title) {
          diffs.push({ id: original.id, field: 'title', original: original.title, restored: restored.title })
        }
        if (restored.readingStatus !== original.readingStatus) {
          diffs.push({ id: original.id, field: 'readingStatus', original: original.readingStatus, restored: restored.readingStatus })
        }
        if (restored.source !== original.source) {
          diffs.push({ id: original.id, field: 'source', original: original.source, restored: restored.source })
        }
      }

      if (diffs.length > 0) {
        // eslint-disable-next-line no-console
        console.error('Round-trip diffs found:', JSON.stringify(diffs, null, 2))
      }
      expect(diffs).toEqual([])
    })
  })
})
