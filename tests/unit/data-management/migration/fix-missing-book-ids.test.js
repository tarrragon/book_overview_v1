/**
 * 既有無 ID 書目修復遷移單元測試
 *
 * 對應 ticket 1.6.0-W4-005，覆蓋：
 * - t1 掃描並補生成 UUID：id 為 falsy 的書目補生成 truthy UUID
 * - t2 已有 id 的書目不被修改
 * - t3 bookId → platformBookId 映射保留
 * - t4 遷移前後書目數量不變且全部 truthy id
 * - t5 多平台（platform_books key）同時掃描
 * - t6 無缺失 id 時跳過修復
 * - t7 寫入失敗時從 backup 還原
 * - t8 null/undefined 書籍安全跳過
 */

const {
  fixMissingBookIds,
  fixBooksMissingIds,
  rollbackMigration
} = require('src/data-management/migration/fix-missing-book-ids')

describe('fix-missing-book-ids migration', () => {
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

  function createBook (overrides = {}) {
    return {
      id: '',
      title: '範例書籍',
      author: '範例作者',
      progress: 30,
      ...overrides
    }
  }

  beforeEach(() => {
    mockLogger = createMockLogger()
  })

  // ──────────────────────────────────────────────────────────────────
  // t1 掃描並補生成 UUID
  // ──────────────────────────────────────────────────────────────────
  test('t1: id 為 falsy 的書目補生成 truthy UUID', async () => {
    const book = createBook({ id: '', title: '無 ID 書籍' })
    mockStorage = createMockStorage({ readmoo_books: [book] })

    const result = await fixMissingBookIds(mockStorage, mockLogger)

    expect(result.fixed).toBe(true)
    expect(result.totalFixed).toBe(1)
    const stored = mockStorage._store.readmoo_books
    expect(stored).toHaveLength(1)
    expect(typeof stored[0].id).toBe('string')
    expect(stored[0].id.length).toBeGreaterThan(0)
    expect(stored[0].title).toBe('無 ID 書籍')
  })

  // ──────────────────────────────────────────────────────────────────
  // t2 已有 id 的書目不被修改
  // ──────────────────────────────────────────────────────────────────
  test('t2: 已有 truthy id 的書目原樣保留（不修改）', async () => {
    const existingBook = createBook({ id: 'existing-id-001', title: '已有 ID' })
    mockStorage = createMockStorage({ readmoo_books: [existingBook] })

    const { books, fixedCount } = fixBooksMissingIds([existingBook], mockLogger)

    expect(fixedCount).toBe(0)
    expect(books[0]).toBe(existingBook)
    expect(books[0].id).toBe('existing-id-001')
  })

  // ──────────────────────────────────────────────────────────────────
  // t3 bookId → platformBookId 映射保留
  // ──────────────────────────────────────────────────────────────────
  test('t3: bookId 存在時映射為 platformBookId 再補生成 id', async () => {
    const book = createBook({ id: '', bookId: 'kobo-original-id-123' })
    mockStorage = createMockStorage({ kobo_books: [book] })

    const result = await fixMissingBookIds(mockStorage, mockLogger)

    expect(result.fixed).toBe(true)
    const stored = mockStorage._store.kobo_books
    expect(stored[0].platformBookId).toBe('kobo-original-id-123')
    expect(stored[0].bookId).toBe('kobo-original-id-123')
    expect(stored[0].id).toBeTruthy()
  })

  // ──────────────────────────────────────────────────────────────────
  // t4 遷移前後書目數量不變且全部 truthy id
  // ──────────────────────────────────────────────────────────────────
  test('t4: 遷移前後書目數量不變且全部有 truthy id', async () => {
    const books = [
      createBook({ id: '', title: '書 A' }),
      createBook({ id: 'has-id', title: '書 B' }),
      createBook({ id: null, title: '書 C' })
    ]
    mockStorage = createMockStorage({ readmoo_books: books })

    const result = await fixMissingBookIds(mockStorage, mockLogger)

    expect(result.fixed).toBe(true)
    const stored = mockStorage._store.readmoo_books
    expect(stored).toHaveLength(3)
    stored.forEach(book => {
      expect(book.id).toBeTruthy()
    })
  })

  // ──────────────────────────────────────────────────────────────────
  // t5 多平台同時掃描
  // ──────────────────────────────────────────────────────────────────
  test('t5: 同時掃描多個 platform_books key', async () => {
    mockStorage = createMockStorage({
      readmoo_books: [createBook({ id: '', title: 'Readmoo 書' })],
      books_com_tw_books: [createBook({ id: '', title: '博客來書' })],
      kobo_books: [createBook({ id: 'already-has-id', title: 'Kobo 書' })]
    })

    const result = await fixMissingBookIds(mockStorage, mockLogger)

    expect(result.fixed).toBe(true)
    expect(result.stats.readmoo_books).toBe(1)
    expect(result.stats.books_com_tw_books).toBe(1)
    expect(result.stats.kobo_books).toBeUndefined()
    expect(mockStorage._store.readmoo_books[0].id).toBeTruthy()
    expect(mockStorage._store.books_com_tw_books[0].id).toBeTruthy()
    expect(mockStorage._store.kobo_books[0].id).toBe('already-has-id')
  })

  // ──────────────────────────────────────────────────────────────────
  // t6 無缺失 id 時跳過修復
  // ──────────────────────────────────────────────────────────────────
  test('t6: 無缺失 id 書目時跳過修復', async () => {
    mockStorage = createMockStorage({
      readmoo_books: [createBook({ id: 'already-has-id' })]
    })

    const result = await fixMissingBookIds(mockStorage, mockLogger)

    expect(result.fixed).toBe(false)
    expect(result.reason).toBe('no_missing_ids')
    expect(mockStorage.set).not.toHaveBeenCalled()
  })

  // ──────────────────────────────────────────────────────────────────
  // t7 寫入失敗時從 backup 還原
  // ──────────────────────────────────────────────────────────────────
  test('t7: 寫入失敗時從 backup 還原原始資料', async () => {
    const originalBook = createBook({ id: '', title: '待修復書籍' })
    mockStorage = createMockStorage({ readmoo_books: [originalBook] })

    let setCallCount = 0
    const originalSet = mockStorage.set
    mockStorage.set = jest.fn((items) => {
      setCallCount++
      // 第一次 set 為 backup，成功；第二次為正式寫回，模擬失敗
      if (setCallCount === 2) {
        return Promise.reject(new Error('storage 寫入失敗'))
      }
      return originalSet(items)
    })

    const result = await fixMissingBookIds(mockStorage, mockLogger)

    expect(result.fixed).toBe(false)
    expect(result.error).toBe('storage 寫入失敗')
    expect(mockStorage._store.readmoo_books).toEqual([originalBook])
    expect(mockStorage._store.migration_backup_missing_ids).toBeUndefined()
  })

  // ──────────────────────────────────────────────────────────────────
  // t8 null/undefined 書籍安全跳過
  // ──────────────────────────────────────────────────────────────────
  test('t8: null/undefined 書籍安全跳過不拋錯', async () => {
    const { books, fixedCount } = fixBooksMissingIds(
      [null, undefined, createBook({ id: '', title: '正常書籍' })],
      mockLogger
    )

    expect(fixedCount).toBe(1)
    expect(books[0]).toBeNull()
    expect(books[1]).toBeUndefined()
    expect(books[2].id).toBeTruthy()
    expect(mockLogger.warn).toHaveBeenCalled()
  })

  // ──────────────────────────────────────────────────────────────────
  // rollbackMigration 直接測試
  // ──────────────────────────────────────────────────────────────────
  test('rollbackMigration: 無 backup 時回報 no_backup', async () => {
    mockStorage = createMockStorage({})

    const result = await rollbackMigration(mockStorage, mockLogger)

    expect(result.restored).toBe(false)
    expect(result.reason).toBe('no_backup')
  })
})
