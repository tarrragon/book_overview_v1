/**
 * Schema Migration cover-XXX → reader-XXX 單元測試
 *
 * 對應 ticket 0.18.0-W6-012.2.2.2，覆蓋 5 案例合併規則（W6-012.2.2 Solution）：
 * - t1 case 1 正常遷移：id 變更 + 自訂欄位保留
 * - t2 case 2 privacyBookId 為空：id 不變 + manual_review 標記
 * - t3 case 3 cover-openbook：secondary key 去重 + legacy_duplicate
 * - t4 case 4 同 privacyBookId 多筆：取新覆寫舊 + tag 並集
 * - t5 atomicity：寫入失敗整批回滾
 * - t6 schema_version 升至 3.1.0：寫入正確
 */

const {
  migrateCoverToReader,
  transformBooks,
  rollbackMigration,
  TARGET_SCHEMA_VERSION
} = require('src/data-management/migration/cover-to-reader')

describe('cover-to-reader migration', () => {
  let mockStorage
  let mockLogger

  /**
   * 建立 chrome.storage.local mock
   * 模擬 Chrome Storage API 的 get/set/remove 行為
   */
  function createMockStorage (initialData = {}) {
    const store = { ...initialData }
    return {
      get: jest.fn((keys) => {
        if (Array.isArray(keys)) {
          const result = {}
          keys.forEach(k => {
            if (k in store) result[k] = store[k]
          })
          return Promise.resolve(result)
        }
        if (typeof keys === 'string') {
          const result = {}
          if (keys in store) result[keys] = store[keys]
          return Promise.resolve(result)
        }
        return Promise.resolve({ ...store })
      }),
      set: jest.fn((items) => {
        Object.assign(store, items)
        return Promise.resolve()
      }),
      remove: jest.fn((keys) => {
        const keyArray = Array.isArray(keys) ? keys : [keys]
        keyArray.forEach(k => delete store[k])
        return Promise.resolve()
      }),
      _store: store
    }
  }

  function createMockLogger () {
    return {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn()
    }
  }

  /**
   * cover-XXX 格式 v3.0 書籍工廠
   * 需求：模擬 v0.17 提取器產出的書籍（id 來自 cover image URL）
   */
  function createCoverBook (overrides = {}) {
    return {
      id: 'cover-abc123',
      title: '範例書籍',
      author: '範例作者',
      coverUrl: 'https://example.com/cover-abc123.jpg',
      readingStatus: 'reading',
      tagIds: ['tag-fiction'],
      progress: 30,
      extractedAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
      identifiers: { privacyBookId: 'pbk-001' },
      ...overrides
    }
  }

  beforeEach(() => {
    mockLogger = createMockLogger()
  })

  // ──────────────────────────────────────────────────────────────────
  // t1 Case 1：正常遷移（cover-XXX + privacyBookId 存在）
  // ──────────────────────────────────────────────────────────────────
  describe('Case 1：正常遷移（cover-XXX → reader-{privacyBookId}）', () => {
    test('id 變更為 reader-{privacyBookId} 且保留所有自訂欄位', async () => {
      const book = createCoverBook({
        id: 'cover-abc123',
        identifiers: { privacyBookId: 'pbk-real-001' },
        tagIds: ['tag-a', 'tag-b'],
        readingStatus: 'reading'
      })
      mockStorage = createMockStorage({
        schema_version: '3.0.0',
        readmoo_books: [book]
      })

      const result = await migrateCoverToReader(mockStorage, mockLogger)

      expect(result.migrated).toBe(true)
      expect(result.stats.migrated).toBe(1)
      const stored = mockStorage._store.readmoo_books
      expect(stored).toHaveLength(1)
      expect(stored[0].id).toBe('reader-pbk-real-001')
      expect(stored[0].legacy_cover_id).toBe('cover-abc123')
      expect(stored[0].tagIds).toEqual(['tag-a', 'tag-b'])
      expect(stored[0].readingStatus).toBe('reading')
      expect(stored[0].coverUrl).toBe('https://example.com/cover-abc123.jpg')
    })
  })

  // ──────────────────────────────────────────────────────────────────
  // t2 Case 2：privacyBookId 為空 → manual_review
  // ──────────────────────────────────────────────────────────────────
  describe('Case 2：privacyBookId 為空（保留舊 id + manual_review 標記）', () => {
    test('id 不變且標記 requires_manual_review=true', async () => {
      const book = createCoverBook({
        id: 'cover-no-pbk',
        identifiers: { privacyBookId: '' }
      })
      mockStorage = createMockStorage({
        schema_version: '3.0.0',
        readmoo_books: [book]
      })

      const result = await migrateCoverToReader(mockStorage, mockLogger)

      expect(result.migrated).toBe(true)
      expect(result.stats.manualReview).toBe(1)
      const stored = mockStorage._store.readmoo_books
      expect(stored[0].id).toBe('cover-no-pbk')
      expect(stored[0].requires_manual_review).toBe(true)
    })

    test('identifiers 物件完全缺失也視為 Case 2', async () => {
      const book = createCoverBook({ id: 'cover-orphan' })
      delete book.identifiers
      mockStorage = createMockStorage({
        schema_version: '3.0.0',
        readmoo_books: [book]
      })

      const result = await migrateCoverToReader(mockStorage, mockLogger)

      expect(result.stats.manualReview).toBe(1)
      expect(mockStorage._store.readmoo_books[0].id).toBe('cover-orphan')
      expect(mockStorage._store.readmoo_books[0].requires_manual_review).toBe(true)
    })
  })

  // ──────────────────────────────────────────────────────────────────
  // t3 Case 3：cover-openbook 共用（secondary key 去重）
  // ──────────────────────────────────────────────────────────────────
  describe('Case 3：cover-openbook 共用（title+extractedAt 去重 + legacy_duplicate）', () => {
    test('不同 title/extractedAt 全部保留並標記 legacy_duplicate', async () => {
      const books = [
        createCoverBook({
          id: 'cover-openbook',
          title: '書籍 A',
          extractedAt: '2026-01-01T00:00:00.000Z'
        }),
        createCoverBook({
          id: 'cover-openbook',
          title: '書籍 B',
          extractedAt: '2026-01-02T00:00:00.000Z'
        })
      ]
      mockStorage = createMockStorage({
        schema_version: '3.0.0',
        readmoo_books: books
      })

      const result = await migrateCoverToReader(mockStorage, mockLogger)

      expect(result.stats.duplicates).toBe(2)
      const stored = mockStorage._store.readmoo_books
      expect(stored).toHaveLength(2)
      stored.forEach(b => {
        expect(b.id).toBe('cover-openbook')
        expect(b.legacy_duplicate).toBe(true)
        expect(b.requires_manual_review).toBe(true)
      })
    })

    test('完全相同 title+extractedAt 視為重複，僅保留首個', async () => {
      const books = [
        createCoverBook({
          id: 'cover-openbook',
          title: '同書',
          extractedAt: '2026-01-01T00:00:00.000Z',
          tagIds: ['tag-1']
        }),
        createCoverBook({
          id: 'cover-openbook',
          title: '同書',
          extractedAt: '2026-01-01T00:00:00.000Z',
          tagIds: ['tag-2']
        })
      ]
      mockStorage = createMockStorage({
        schema_version: '3.0.0',
        readmoo_books: books
      })

      const result = await migrateCoverToReader(mockStorage, mockLogger)

      expect(result.stats.duplicates).toBe(1)
      expect(mockStorage._store.readmoo_books).toHaveLength(1)
    })
  })

  // ──────────────────────────────────────────────────────────────────
  // t4 Case 4：同 privacyBookId 多筆（時間新者勝 + tag 並集）
  // ──────────────────────────────────────────────────────────────────
  describe('Case 4：同 privacyBookId 多筆（新者覆寫舊 + tag 並集）', () => {
    test('遷移後同 reader-id 兩筆，取較新 updatedAt 為主、tagIds 採並集', async () => {
      const older = createCoverBook({
        id: 'cover-old-snapshot',
        identifiers: { privacyBookId: 'pbk-dup' },
        tagIds: ['tag-old', 'tag-shared'],
        readingStatus: 'unread',
        updatedAt: '2025-01-01T00:00:00.000Z'
      })
      const newer = createCoverBook({
        id: 'cover-new-snapshot',
        identifiers: { privacyBookId: 'pbk-dup' },
        tagIds: ['tag-new', 'tag-shared'],
        readingStatus: 'finished',
        updatedAt: '2026-05-01T00:00:00.000Z'
      })
      mockStorage = createMockStorage({
        schema_version: '3.0.0',
        readmoo_books: [older, newer]
      })

      const result = await migrateCoverToReader(mockStorage, mockLogger)

      expect(result.migrated).toBe(true)
      const stored = mockStorage._store.readmoo_books
      expect(stored).toHaveLength(1)
      expect(stored[0].id).toBe('reader-pbk-dup')
      expect(stored[0].readingStatus).toBe('finished')
      // tagIds 並集：以較新為先（tag-new, tag-shared），加上舊獨有的（tag-old）
      expect(stored[0].tagIds).toContain('tag-new')
      expect(stored[0].tagIds).toContain('tag-old')
      expect(stored[0].tagIds).toContain('tag-shared')
      // 不重複
      expect(stored[0].tagIds.filter(t => t === 'tag-shared')).toHaveLength(1)
    })
  })

  // ──────────────────────────────────────────────────────────────────
  // t5 Atomicity：寫入失敗整批回滾
  // ──────────────────────────────────────────────────────────────────
  describe('Atomicity：寫入失敗時整批回滾', () => {
    test('schema_version 寫入失敗時，readmoo_books 還原為原始 backup', async () => {
      const originalBooks = [createCoverBook({ id: 'cover-original' })]
      mockStorage = createMockStorage({
        schema_version: '3.0.0',
        readmoo_books: originalBooks
      })

      // 模擬：第三次 set 拋出（schema_version 寫入失敗）
      let setCallCount = 0
      const originalSet = mockStorage.set
      mockStorage.set = jest.fn(async (items) => {
        setCallCount++
        // 第一次：backup；第二次：readmoo_books；第三次：schema_version → 失敗
        if (setCallCount === 3) {
          throw new Error('Simulated schema_version write failure')
        }
        return originalSet(items)
      })

      const result = await migrateCoverToReader(mockStorage, mockLogger)

      expect(result.migrated).toBe(false)
      expect(result.error).toMatch(/Simulated schema_version write failure/)
      // 回滾後 readmoo_books 應還原為 originalBooks
      const restored = mockStorage._store.readmoo_books
      expect(restored).toHaveLength(1)
      expect(restored[0].id).toBe('cover-original')
    })
  })

  // ──────────────────────────────────────────────────────────────────
  // t6 schema_version 升至 3.1.0
  // ──────────────────────────────────────────────────────────────────
  describe('schema_version 升級', () => {
    test('成功遷移後 schema_version 寫入 3.1.0', async () => {
      const book = createCoverBook({
        id: 'cover-version',
        identifiers: { privacyBookId: 'pbk-version' }
      })
      mockStorage = createMockStorage({
        schema_version: '3.0.0',
        readmoo_books: [book]
      })

      const result = await migrateCoverToReader(mockStorage, mockLogger)

      expect(result.migrated).toBe(true)
      expect(mockStorage._store.schema_version).toBe('3.1.0')
      expect(TARGET_SCHEMA_VERSION).toBe('3.1.0')
    })

    test('schema_version 已是 3.1.0 時跳過遷移（冪等性）', async () => {
      const book = createCoverBook({ id: 'cover-already' })
      mockStorage = createMockStorage({
        schema_version: '3.1.0',
        readmoo_books: [book]
      })

      const result = await migrateCoverToReader(mockStorage, mockLogger)

      expect(result.migrated).toBe(false)
      expect(result.reason).toBe('already_migrated')
      // 書籍未被改動
      expect(mockStorage._store.readmoo_books[0].id).toBe('cover-already')
    })
  })

  // ──────────────────────────────────────────────────────────────────
  // 純函式：transformBooks 直接呼叫（不經 storage）
  // ──────────────────────────────────────────────────────────────────
  describe('transformBooks 純函式', () => {
    test('混合多案例同時處理且 stats 正確', () => {
      const books = [
        createCoverBook({ id: 'cover-1', identifiers: { privacyBookId: 'pbk-1' } }),
        createCoverBook({ id: 'cover-2', identifiers: { privacyBookId: '' } }),
        createCoverBook({ id: 'cover-openbook', title: 'A', extractedAt: '2026-01-01' }),
        createCoverBook({ id: 'reader-existing', identifiers: { privacyBookId: 'pbk-existing' } })
      ]
      const { books: transformed, stats } = transformBooks(books, mockLogger)

      expect(stats.migrated).toBe(1)
      expect(stats.manualReview).toBe(1)
      expect(stats.duplicates).toBe(1)
      expect(stats.unchanged).toBe(1)
      expect(transformed).toHaveLength(4)
    })

    test('null/undefined 書籍與缺 id 書籍被跳過', () => {
      const books = [null, undefined, { title: '無 id' }, createCoverBook({ id: 'cover-ok', identifiers: { privacyBookId: 'pbk-ok' } })]
      const { books: transformed, stats } = transformBooks(books, mockLogger)
      expect(transformed).toHaveLength(1)
      expect(transformed[0].id).toBe('reader-pbk-ok')
      expect(stats.migrated).toBe(1)
    })
  })

  // ──────────────────────────────────────────────────────────────────
  // rollbackMigration 直接呼叫
  // ──────────────────────────────────────────────────────────────────
  describe('rollbackMigration', () => {
    test('有 backup 時還原 readmoo_books 並刪除 backup', async () => {
      const backupBooks = [createCoverBook({ id: 'cover-backup' })]
      mockStorage = createMockStorage({
        migration_backup_v3_1: { readmoo_books: backupBooks },
        readmoo_books: [createCoverBook({ id: 'cover-corrupted' })]
      })

      const result = await rollbackMigration(mockStorage, mockLogger)

      expect(result.restored).toBe(true)
      expect(mockStorage._store.readmoo_books[0].id).toBe('cover-backup')
      expect(mockStorage._store.migration_backup_v3_1).toBeUndefined()
    })

    test('無 backup 時回傳 reason=no_backup', async () => {
      mockStorage = createMockStorage({})
      const result = await rollbackMigration(mockStorage, mockLogger)
      expect(result.restored).toBe(false)
      expect(result.reason).toBe('no_backup')
    })
  })
})
