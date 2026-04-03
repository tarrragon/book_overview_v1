/**
 * Schema Migration v2 Tests
 *
 * TDD Phase 3b — 資料遷移 v1 → v2（Tag-based Book Model）測試
 *
 * 測試群組：
 * 1. 遷移觸發條件（schema_version 判斷）
 * 2. 閱讀狀態轉換（isNew/isFinished → readingStatus）
 * 3. progress 值正規化
 * 4. 欄位增刪轉換
 * 5. 邊界條件
 * 6. 備份與回滾
 * 7. 冪等性
 */

const { migrateV1ToV2, migrateReadingStatus, normalizeProgress, rollbackMigration } = require('src/data-management/migration/v1-to-v2')

describe('Schema Migration v1 → v2', () => {
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
      // 測試用：直接存取底層 store
      _store: store,
      // 測試用：模擬配額不足
      _simulateQuotaError: false
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
   * v1 格式書籍工廠函式
   * 需求：v1 書籍有 isNew, isFinished, progress 欄位，無 readingStatus, tagIds
   */
  function createV1Book (overrides = {}) {
    return {
      id: 'book-001',
      title: '測試書籍',
      author: '測試作者',
      coverUrl: 'https://example.com/cover.jpg',
      isNew: false,
      isFinished: false,
      progress: 0,
      addedAt: '2025-01-01T00:00:00Z',
      ...overrides
    }
  }

  /**
   * 完整 v1 storage 資料工廠
   */
  function createV1StorageData (books = [], schemaVersion = null) {
    const data = {
      readmoo_books: books
    }
    if (schemaVersion !== undefined) {
      data.schema_version = schemaVersion
    }
    return data
  }

  beforeEach(() => {
    mockLogger = createMockLogger()
    jest.useFakeTimers()
    jest.setSystemTime(new Date('2026-04-04T00:00:00Z'))
  })

  afterEach(() => {
    jest.useRealTimers()
  })

  // ============================================================
  // 群組 1：遷移觸發條件
  // 功能職責：判斷是否需要執行遷移
  // 跨群組依賴：無
  // ============================================================
  describe('遷移觸發條件', () => {
    test('schema_version 為 null 時應觸發遷移', async () => {
      mockStorage = createMockStorage(
        createV1StorageData([createV1Book()], null)
      )

      const result = await migrateV1ToV2(mockStorage, mockLogger)
      expect(result.migrated).toBe(true)
      expect(mockStorage._store.schema_version).toBe('3.0.0')
    })

    test('schema_version 為 "2.0.0" 時應觸發遷移', async () => {
      mockStorage = createMockStorage(
        createV1StorageData([createV1Book()], '2.0.0')
      )

      const result = await migrateV1ToV2(mockStorage, mockLogger)
      expect(result.migrated).toBe(true)
    })

    test('schema_version 為 "3.0.0" 時應跳過遷移', async () => {
      mockStorage = createMockStorage(
        createV1StorageData([createV1Book()], '3.0.0')
      )

      const result = await migrateV1ToV2(mockStorage, mockLogger)
      expect(result.migrated).toBe(false)
      expect(result.reason).toBe('already_migrated')
    })

    test('schema_version 為未知值時應記錄 warning 並嘗試遷移（視為 v1）', async () => {
      mockStorage = createMockStorage(
        createV1StorageData([createV1Book()], '99.0.0')
      )

      const result = await migrateV1ToV2(mockStorage, mockLogger)
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('未知版本')
      )
      expect(result.migrated).toBe(true)
    })

    test('schema_version 格式無效（非 semver）時應記錄 error 並觸發遷移', async () => {
      mockStorage = createMockStorage(
        createV1StorageData([createV1Book()], 'not-a-version')
      )

      const result = await migrateV1ToV2(mockStorage, mockLogger)
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining('格式無效')
      )
      expect(result.migrated).toBe(true)
    })
  })

  // ============================================================
  // 群組 2：閱讀狀態轉換（migrateReadingStatus）
  // 功能職責：isNew/isFinished/progress → readingStatus
  // 跨群組依賴：無（純函式）
  // ============================================================
  describe('閱讀狀態轉換', () => {
    // 需求：isFinished === true 時，無論其他欄位，結果為 'finished'
    test('isFinished=true, isNew=false → finished', () => {
      const book = createV1Book({ isFinished: true, isNew: false, progress: 50 })
      expect(migrateReadingStatus(book)).toBe('finished')
    })

    test('isFinished=true, isNew=true → finished', () => {
      const book = createV1Book({ isFinished: true, isNew: true, progress: 0 })
      expect(migrateReadingStatus(book)).toBe('finished')
    })

    // 需求：progress >= 100 且 isFinished 非 true 時，結果為 'finished'
    test('progress=100, isFinished=false → finished', () => {
      const book = createV1Book({ isFinished: false, progress: 100 })
      expect(migrateReadingStatus(book)).toBe('finished')
    })

    // 需求：progress > 0 且 < 100 且 isFinished 非 true → 'reading'
    test('isNew=true, isFinished=false, progress=50 → reading', () => {
      const book = createV1Book({ isNew: true, isFinished: false, progress: 50 })
      expect(migrateReadingStatus(book)).toBe('reading')
    })

    test('isNew=false, isFinished=false, progress=30 → reading', () => {
      const book = createV1Book({ isNew: false, isFinished: false, progress: 30 })
      expect(migrateReadingStatus(book)).toBe('reading')
    })

    // 需求：progress === 0 且 isFinished 非 true → 'unread'
    test('isNew=true, isFinished=false, progress=0 → unread', () => {
      const book = createV1Book({ isNew: true, isFinished: false, progress: 0 })
      expect(migrateReadingStatus(book)).toBe('unread')
    })

    test('isNew=false, isFinished=false, progress=0 → unread', () => {
      const book = createV1Book({ isNew: false, isFinished: false, progress: 0 })
      expect(migrateReadingStatus(book)).toBe('unread')
    })

    // 需求：欄位為 undefined 時的推斷
    test('isNew=undefined, isFinished=undefined, progress=0 → unread', () => {
      const book = createV1Book({ isNew: undefined, isFinished: undefined, progress: 0 })
      expect(migrateReadingStatus(book)).toBe('unread')
    })

    test('isNew=undefined, isFinished=undefined, progress=50 → reading', () => {
      const book = createV1Book({ isNew: undefined, isFinished: undefined, progress: 50 })
      expect(migrateReadingStatus(book)).toBe('reading')
    })

    test('isNew=undefined, isFinished=undefined, progress=100 → finished', () => {
      const book = createV1Book({ isNew: undefined, isFinished: undefined, progress: 100 })
      expect(migrateReadingStatus(book)).toBe('finished')
    })
  })

  // ============================================================
  // 群組 3：progress 值正規化
  // 功能職責：各種 progress 格式 → number 0~100
  // 跨群組依賴：無（純函式）
  // ============================================================
  describe('progress 值正規化', () => {
    test('number 50 → 保留 50', () => {
      expect(normalizeProgress(50)).toBe(50)
    })

    test('number 0 → 保留 0', () => {
      expect(normalizeProgress(0)).toBe(0)
    })

    test('number 100 → 保留 100', () => {
      expect(normalizeProgress(100)).toBe(100)
    })

    test('object {progress: 75} → 提取 75', () => {
      expect(normalizeProgress({ progress: 75 })).toBe(75)
    })

    test('string "50" → parseInt 為 50', () => {
      expect(normalizeProgress('50')).toBe(50)
    })

    test('null → 0', () => {
      expect(normalizeProgress(null)).toBe(0)
    })

    test('undefined → 0', () => {
      expect(normalizeProgress(undefined)).toBe(0)
    })

    test('負數 -10 → clamp 為 0', () => {
      expect(normalizeProgress(-10)).toBe(0)
    })

    test('超過 100 的值 150 → clamp 為 100', () => {
      expect(normalizeProgress(150)).toBe(100)
    })

    test('非數值字串 "abc" → 0', () => {
      expect(normalizeProgress('abc')).toBe(0)
    })
  })

  // ============================================================
  // 群組 4：完整欄位轉換
  // 功能職責：單本書的 v1 → v2 欄位增刪
  // 跨群組依賴：依賴群組 2（readingStatus）和群組 3（progress 正規化）
  // ============================================================
  describe('欄位轉換', () => {
    test('應刪除 isNew 和 isFinished 欄位', async () => {
      const v1Book = createV1Book({ isNew: true, isFinished: false, progress: 0 })
      mockStorage = createMockStorage(createV1StorageData([v1Book]))

      await migrateV1ToV2(mockStorage, mockLogger)
      const books = mockStorage._store.readmoo_books
      expect(books[0]).not.toHaveProperty('isNew')
      expect(books[0]).not.toHaveProperty('isFinished')
    })

    test('應新增 readingStatus 欄位（依轉換規則）', async () => {
      const v1Book = createV1Book({ isFinished: true, progress: 80 })
      mockStorage = createMockStorage(createV1StorageData([v1Book]))

      await migrateV1ToV2(mockStorage, mockLogger)
      const books = mockStorage._store.readmoo_books
      expect(books[0].readingStatus).toBe('finished')
    })

    test('應新增 tagIds 為空陣列', async () => {
      const v1Book = createV1Book()
      mockStorage = createMockStorage(createV1StorageData([v1Book]))

      await migrateV1ToV2(mockStorage, mockLogger)
      const books = mockStorage._store.readmoo_books
      expect(books[0].tagIds).toEqual([])
    })

    test('應新增 isManualStatus 為 false', async () => {
      const v1Book = createV1Book()
      mockStorage = createMockStorage(createV1StorageData([v1Book]))

      await migrateV1ToV2(mockStorage, mockLogger)
      const books = mockStorage._store.readmoo_books
      expect(books[0].isManualStatus).toBe(false)
    })

    test('應新增 updatedAt 為遷移時間', async () => {
      const v1Book = createV1Book()
      mockStorage = createMockStorage(createV1StorageData([v1Book]))

      await migrateV1ToV2(mockStorage, mockLogger)
      const books = mockStorage._store.readmoo_books
      expect(books[0].updatedAt).toBe('2026-04-04T00:00:00.000Z')
    })

    test('應保留原有欄位（id, title, author, coverUrl, addedAt, progress）', async () => {
      const v1Book = createV1Book({
        id: 'book-999',
        title: '保留測試',
        author: '保留作者',
        progress: 42
      })
      mockStorage = createMockStorage(createV1StorageData([v1Book]))

      await migrateV1ToV2(mockStorage, mockLogger)
      const book = mockStorage._store.readmoo_books[0]
      expect(book.id).toBe('book-999')
      expect(book.title).toBe('保留測試')
      expect(book.author).toBe('保留作者')
      expect(book.progress).toBe(42)
    })
  })

  // ============================================================
  // 群組 5：遷移步驟（tag_categories / tags / schema_version）
  // 功能職責：除書籍轉換外的 storage key 建立
  // 跨群組依賴：無
  // ============================================================
  describe('遷移步驟 — 預設資料建立', () => {
    test('應備份原始資料至 migration_backup key', async () => {
      const v1Book = createV1Book()
      mockStorage = createMockStorage(createV1StorageData([v1Book]))

      // 備份會在遷移過程中建立，但成功後會被刪除
      // 為了驗證備份確實被建立，我們在 set 被呼叫時檢查
      const originalSet = mockStorage.set
      let backupWasCreated = false
      mockStorage.set = jest.fn((items) => {
        if (items.migration_backup) {
          backupWasCreated = true
          expect(items.migration_backup.readmoo_books).toHaveLength(1)
        }
        return originalSet(items)
      })

      await migrateV1ToV2(mockStorage, mockLogger)
      expect(backupWasCreated).toBe(true)
    })

    test('應建立 tag_categories 預設資料（2 個類別）', async () => {
      mockStorage = createMockStorage(createV1StorageData([]))

      await migrateV1ToV2(mockStorage, mockLogger)
      const categories = mockStorage._store.tag_categories
      expect(categories).toHaveLength(2)
      expect(categories[0].id).toBe('cat_system_type')
      expect(categories[0].name).toBe('書籍類型')
      expect(categories[1].id).toBe('cat_user_custom')
      expect(categories[1].name).toBe('自訂標籤')
    })

    test('應建立 tags 空陣列', async () => {
      mockStorage = createMockStorage(createV1StorageData([]))

      await migrateV1ToV2(mockStorage, mockLogger)
      expect(mockStorage._store.tags).toEqual([])
    })

    test('應寫入 schema_version 為 "3.0.0"', async () => {
      mockStorage = createMockStorage(createV1StorageData([]))

      await migrateV1ToV2(mockStorage, mockLogger)
      expect(mockStorage._store.schema_version).toBe('3.0.0')
    })

    test('成功後應刪除 migration_backup', async () => {
      mockStorage = createMockStorage(createV1StorageData([createV1Book()]))

      await migrateV1ToV2(mockStorage, mockLogger)
      expect(mockStorage._store.migration_backup).toBeUndefined()
    })
  })

  // ============================================================
  // 群組 6：邊界條件
  // 功能職責：異常輸入的容錯處理
  // 跨群組依賴：依賴群組 4（欄位轉換）
  // ============================================================
  describe('邊界條件', () => {
    test('books 陣列為空時應正常完成遷移', async () => {
      mockStorage = createMockStorage(createV1StorageData([]))

      const result = await migrateV1ToV2(mockStorage, mockLogger)
      expect(result.migrated).toBe(true)
      expect(mockStorage._store.readmoo_books).toEqual([])
      expect(mockStorage._store.schema_version).toBe('3.0.0')
    })

    test('books 含 null 元素時應跳過並記錄 warning', async () => {
      const books = [createV1Book({ id: 'book-1' }), null, createV1Book({ id: 'book-2' })]
      mockStorage = createMockStorage(createV1StorageData(books))

      await migrateV1ToV2(mockStorage, mockLogger)
      expect(mockLogger.warn).toHaveBeenCalled()
      const migratedBooks = mockStorage._store.readmoo_books
      expect(migratedBooks).toHaveLength(2)
    })

    test('書籍缺少 id 時應跳過並記錄 error', async () => {
      const bookNoId = createV1Book({ id: undefined })
      mockStorage = createMockStorage(createV1StorageData([bookNoId]))

      await migrateV1ToV2(mockStorage, mockLogger)
      expect(mockLogger.error).toHaveBeenCalled()
      expect(mockStorage._store.readmoo_books).toEqual([])
    })

    test('已是 v2 格式的書籍應跳過轉換', async () => {
      const v2Book = {
        id: 'book-v2',
        title: '已轉換的書',
        readingStatus: 'reading',
        tagIds: ['tag-1'],
        isManualStatus: false,
        progress: 50,
        updatedAt: '2026-01-01T00:00:00Z'
      }
      mockStorage = createMockStorage(createV1StorageData([v2Book]))

      await migrateV1ToV2(mockStorage, mockLogger)
      const book = mockStorage._store.readmoo_books[0]
      expect(book.readingStatus).toBe('reading')
      expect(book.tagIds).toEqual(['tag-1'])
    })

    test('readmoo_books key 不存在時應建立空結構', async () => {
      mockStorage = createMockStorage({ schema_version: null })

      await migrateV1ToV2(mockStorage, mockLogger)
      expect(mockStorage._store.readmoo_books).toEqual([])
      expect(mockStorage._store.schema_version).toBe('3.0.0')
    })

    test('多本書籍混合遷移 — 部分失敗不影響其他', async () => {
      const books = [
        createV1Book({ id: 'ok-1', progress: 50 }),
        createV1Book({ id: undefined }), // 缺少 id，應跳過
        createV1Book({ id: 'ok-2', isFinished: true })
      ]
      mockStorage = createMockStorage(createV1StorageData(books))

      await migrateV1ToV2(mockStorage, mockLogger)
      const migratedBooks = mockStorage._store.readmoo_books
      expect(migratedBooks).toHaveLength(2)
      expect(migratedBooks[0].id).toBe('ok-1')
      expect(migratedBooks[0].readingStatus).toBe('reading')
      expect(migratedBooks[1].id).toBe('ok-2')
      expect(migratedBooks[1].readingStatus).toBe('finished')
    })

    test('超大資料（1000 本書）應能正常遷移', async () => {
      const books = Array.from({ length: 1000 }, (_, i) =>
        createV1Book({ id: `book-${i}`, progress: i % 101 })
      )
      mockStorage = createMockStorage(createV1StorageData(books))

      const result = await migrateV1ToV2(mockStorage, mockLogger)
      expect(result.migrated).toBe(true)
      expect(mockStorage._store.readmoo_books).toHaveLength(1000)
    })
  })

  // ============================================================
  // 群組 7：備份與回滾
  // 功能職責：遷移失敗時的資料保護
  // 跨群組依賴：依賴群組 5（備份機制）
  // ============================================================
  describe('備份與回滾', () => {
    test('備份失敗時應中止遷移，保持 v1 資料不變', async () => {
      const v1Book = createV1Book()
      mockStorage = createMockStorage(createV1StorageData([v1Book]))
      // 模擬第一次 set（備份）失敗
      const originalSet = mockStorage.set
      mockStorage.set = jest.fn().mockRejectedValueOnce(new Error('Storage full'))
        .mockImplementation(originalSet)

      const result = await migrateV1ToV2(mockStorage, mockLogger)
      expect(result.migrated).toBe(false)
      expect(result.error).toBeDefined()
      // 原始資料應完整保留
      expect(mockStorage._store.readmoo_books[0].isNew).toBeDefined()
    })

    test('寫入失敗時應從 backup 還原', async () => {
      const v1Book = createV1Book({ id: 'original' })
      mockStorage = createMockStorage(createV1StorageData([v1Book]))

      // 模擬：備份成功，但後續寫入 schema_version 失敗
      let callCount = 0
      const originalSet = mockStorage.set.getMockImplementation() || mockStorage.set
      mockStorage.set = jest.fn((items) => {
        callCount++
        // 第一次 set（備份）成功，第四次 set（schema_version）失敗
        if (callCount >= 4) {
          return Promise.reject(new Error('Write failed'))
        }
        return originalSet(items)
      })

      const result = await migrateV1ToV2(mockStorage, mockLogger)
      expect(result.migrated).toBe(false)
      // 應從 backup 還原
      expect(mockStorage._store.readmoo_books[0].id).toBe('original')
      expect(mockStorage._store.readmoo_books[0].isNew).toBeDefined()
    })

    test('配額不足時應中止遷移，保持 v1', async () => {
      mockStorage = createMockStorage(createV1StorageData([createV1Book()]))
      mockStorage.set = jest.fn().mockRejectedValue(
        Object.assign(new Error('QUOTA_BYTES_PER_ITEM quota exceeded'), {
          message: 'QUOTA_BYTES_PER_ITEM quota exceeded'
        })
      )

      const result = await migrateV1ToV2(mockStorage, mockLogger)
      expect(result.migrated).toBe(false)
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining('配額')
      )
    })

    test('回滾時 backup 不存在應保持現狀', async () => {
      // 模擬：遷移中途失敗，且 backup 已被意外刪除
      mockStorage = createMockStorage({
        schema_version: null,
        readmoo_books: [createV1Book()]
        // 注意：無 migration_backup
      })

      // 直接測試回滾函式
      const rollbackResult = await rollbackMigration(mockStorage, mockLogger)
      expect(rollbackResult.restored).toBe(false)
      expect(rollbackResult.reason).toBe('no_backup')
      // 原始資料不應被破壞
      expect(mockStorage._store.readmoo_books).toHaveLength(1)
    })

    test('回滾成功後應刪除新建的 key（tag_categories, tags）', async () => {
      mockStorage = createMockStorage({
        schema_version: '3.0.0',
        readmoo_books: [{ id: 'migrated', readingStatus: 'reading', tagIds: [] }],
        tag_categories: [{ id: 'cat_system_type' }],
        tags: [],
        migration_backup: {
          readmoo_books: [createV1Book({ id: 'migrated' })]
        }
      })

      const result = await rollbackMigration(mockStorage, mockLogger)
      expect(result.restored).toBe(true)
      expect(mockStorage._store.tag_categories).toBeUndefined()
      expect(mockStorage._store.tags).toBeUndefined()
      expect(mockStorage._store.readmoo_books[0].isNew).toBeDefined()
    })
  })

  // ============================================================
  // 群組 8：冪等性
  // 功能職責：重複執行遷移不產生副作用
  // 跨群組依賴：依賴群組 4、5
  // ============================================================
  describe('冪等性', () => {
    test('對已遷移的資料再次執行應跳過（schema_version=3.0.0）', async () => {
      mockStorage = createMockStorage({
        schema_version: '3.0.0',
        readmoo_books: [{ id: 'book-1', readingStatus: 'reading', tagIds: [] }],
        tag_categories: [{ id: 'cat_system_type' }],
        tags: []
      })

      const result = await migrateV1ToV2(mockStorage, mockLogger)
      expect(result.migrated).toBe(false)
      // 資料不應被修改
      expect(mockStorage.set).not.toHaveBeenCalled()
    })

    test('中斷後重啟 — 部分遷移狀態下應能安全重新遷移', async () => {
      // 模擬：上次遷移中斷，backup 存在但 schema_version 未更新
      mockStorage = createMockStorage({
        schema_version: null,
        readmoo_books: [createV1Book()],
        migration_backup: {
          readmoo_books: [createV1Book()]
        }
      })

      const result = await migrateV1ToV2(mockStorage, mockLogger)
      expect(result.migrated).toBe(true)
      expect(mockStorage._store.schema_version).toBe('3.0.0')
    })
  })
})
