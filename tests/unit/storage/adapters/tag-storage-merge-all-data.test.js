/**
 * tag-storage-adapter.mergeAllData 合併模式整批寫入測試
 * TDD Phase 3b — 0.19.0-W1-047.4（IMP-D，UC-04 合併模式與 storage 持久化）
 *
 * 測試對象：mergeAllData 公開 API
 *   - 合併結果原子寫回三 key（TC-M1~M4）
 *   - 配額攔截（TC-M5~M6）
 *   - 原子回滾（TC-M7~M9）
 *   - 空匯入與並發序列化（TC-M10~M11）
 *
 * 規格來源：docs/work-logs/v0/v0.19/v0.19.0/tickets/0.19.0-W1-047.4-feature-spec.md
 * 測試遵循 test-assertion-design 規則：無計時硬門檻；並發以執行順序 / 最終狀態斷言。
 * createStorageMock 沿用 tag-storage-replace-all-data.test.js 同款（有狀態 store + setHook）。
 */

const TagStorageAdapter = require('src/storage/adapters/tag-storage-adapter')

const STORAGE_KEYS = TagStorageAdapter.STORAGE_KEYS
const MAX_STORAGE_SIZE = TagStorageAdapter.MAX_STORAGE_SIZE
const QUOTA_THRESHOLDS = TagStorageAdapter.QUOTA_THRESHOLDS

// --- Chrome Storage Mock 工具（沿用 replace-all-data 測試同款）---

/**
 * 建立具狀態的 chrome.storage.local mock
 * @param {Object} [options]
 * @param {number} [options.bytesInUse] - 固定回傳的 getBytesInUse 值（用於配額測試）
 * @param {Function} [options.setHook] - set 攔截器：回傳 true 表示模擬寫入失敗
 * @returns {Object} store 物件（測試可直接讀寫斷言）
 */
function createStorageMock (options = {}) {
  const store = {}

  delete chrome.runtime.lastError

  chrome.storage.local.get.mockImplementation((keys, callback) => {
    const result = {}
    const keyList = Array.isArray(keys) ? keys : [keys]
    keyList.forEach(key => {
      result[key] = store[key] !== undefined
        ? JSON.parse(JSON.stringify(store[key]))
        : undefined
    })
    callback(result)
  })

  chrome.storage.local.set.mockImplementation((items, callback) => {
    if (options.setHook && options.setHook(items, store) === true) {
      chrome.runtime.lastError = { message: 'simulated set failure' }
      if (callback) callback()
      delete chrome.runtime.lastError
      return
    }
    Object.keys(items).forEach(key => {
      store[key] = JSON.parse(JSON.stringify(items[key]))
    })
    if (callback) callback()
  })

  chrome.storage.local.getBytesInUse.mockImplementation((keys, callback) => {
    if (typeof options.bytesInUse === 'number') {
      callback(options.bytesInUse)
      return
    }
    callback(JSON.stringify(store).length)
  })

  return store
}

// --- 測試資料工廠 ---

const makeBook = (id, overrides = {}) => ({
  id,
  title: `書籍 ${id}`,
  cover: `https://example.com/${id}.jpg`,
  progress: 0,
  tagIds: [],
  ...overrides
})

const makeTag = (id, name, categoryId, overrides = {}) => ({
  id,
  name,
  categoryId,
  isSystem: false,
  sortOrder: 0,
  createdAt: '2025-01-01T00:00:00Z',
  updatedAt: '2025-01-01T00:00:00Z',
  ...overrides
})

const makeCategory = (id, name, overrides = {}) => ({
  id,
  name,
  description: '',
  color: '#333333',
  isSystem: false,
  sortOrder: 0,
  createdAt: '2025-01-01T00:00:00Z',
  updatedAt: '2025-01-01T00:00:00Z',
  ...overrides
})

// ===========================================================================

describe('mergeAllData — 合併模式整批寫入（UC-04 匯入）', () => {
  beforeEach(() => {
    global.testUtils.cleanup()
  })

  // -------------------------------------------------------------------------
  // 測試群組 H：原子持久化成功（AC-10）
  // -------------------------------------------------------------------------
  describe('測試群組 H：原子持久化成功', () => {
    test('TC-M1 合併結果原子寫回三 key', async () => {
      const store = createStorageMock()
      // 預置本地資料
      store[STORAGE_KEYS.READMOO_BOOKS] = [makeBook('book-001')]
      store[STORAGE_KEYS.TAGS] = [makeTag('t_local_1', '科幻', 'cat_local_1')]
      store[STORAGE_KEYS.TAG_CATEGORIES] = [makeCategory('cat_local_1', '書籍類型')]

      const result = await TagStorageAdapter.mergeAllData({
        books: [makeBook('book-999')],
        tags: [makeTag('t_imp_1', '歷史', 'c_imp')],
        tagCategories: [makeCategory('c_imp', '閱讀清單')]
      })

      expect(result.success).toBe(true)
      // counts 為合併後筆數（本地 + 新增）
      expect(result.counts.books).toBe(2)
      expect(result.counts.tags).toBe(2)
      expect(result.counts.tagCategories).toBe(2)
      // remap 統計存在
      expect(result.remap).toEqual({ categories: 0, tags: 0 })
      // 三 storage key 為合併後集合
      expect(store[STORAGE_KEYS.READMOO_BOOKS]).toHaveLength(2)
      expect(store[STORAGE_KEYS.TAGS]).toHaveLength(2)
      expect(store[STORAGE_KEYS.TAG_CATEGORIES]).toHaveLength(2)
    })

    test('TC-M2 books wrapper 結構保持', async () => {
      const store = createStorageMock()
      // readmoo_books 為 wrapper 物件
      store[STORAGE_KEYS.READMOO_BOOKS] = {
        books: [makeBook('book-001')],
        extractionTimestamp: '2025-01-01T00:00:00Z'
      }

      await TagStorageAdapter.mergeAllData({
        books: [makeBook('book-999')],
        tags: [],
        tagCategories: []
      })

      const written = store[STORAGE_KEYS.READMOO_BOOKS]
      // 寫回仍為 wrapper 物件形式
      expect(Array.isArray(written)).toBe(false)
      expect(written).toHaveProperty('books')
      // books 為合併後陣列（本地 1 + 新增 1）
      expect(written.books).toHaveLength(2)
      // extractionTimestamp 既有欄位保留
      expect(written.extractionTimestamp).toBe('2025-01-01T00:00:00Z')
    })

    test('TC-M3 同 id 更新、新 id 新增、永不清空', async () => {
      const store = createStorageMock()
      store[STORAGE_KEYS.READMOO_BOOKS] = [
        makeBook('book-001'),
        makeBook('book-002'),
        makeBook('book-003')
      ]
      store[STORAGE_KEYS.TAGS] = []
      store[STORAGE_KEYS.TAG_CATEGORIES] = []

      await TagStorageAdapter.mergeAllData({
        books: [
          makeBook('book-001', { title: '更新書名' }),
          makeBook('book-NEW')
        ],
        tags: [],
        tagCategories: []
      })

      // 終態 4 本書（本地未匹配的 book-002、book-003 原樣保留）
      expect(store[STORAGE_KEYS.READMOO_BOOKS]).toHaveLength(4)
      const ids = store[STORAGE_KEYS.READMOO_BOOKS].map(b => b.id)
      expect(ids).toEqual(expect.arrayContaining([
        'book-001', 'book-002', 'book-003', 'book-NEW'
      ]))
      // book-001 標題以匯入覆蓋
      const updated = store[STORAGE_KEYS.READMOO_BOOKS].find(b => b.id === 'book-001')
      expect(updated.title).toBe('更新書名')
    })

    test('TC-M4 counts 與 remap 統計正確', async () => {
      const store = createStorageMock()
      store[STORAGE_KEYS.READMOO_BOOKS] = []
      store[STORAGE_KEYS.TAGS] = []
      store[STORAGE_KEYS.TAG_CATEGORIES] = [makeCategory('cat_local_1', '書籍類型')]

      const result = await TagStorageAdapter.mergeAllData({
        books: [],
        tags: [],
        // 1 同名 category + 1 新 category
        tagCategories: [
          makeCategory('c_imp_same', '書籍類型'),
          makeCategory('c_imp_new', '閱讀清單')
        ]
      })

      // counts.tagCategories 為 2（本地 1 + 新建 1）
      expect(result.counts.tagCategories).toBe(2)
      // remap.categories 為 1（同名映射至既有，新建不計入）
      expect(result.remap.categories).toBe(1)
    })
  })

  // -------------------------------------------------------------------------
  // 測試群組 I：配額攔截（AC-11）
  // -------------------------------------------------------------------------
  describe('測試群組 I：配額攔截', () => {
    test('TC-M5 配額 blocked 攔截：不寫入、三 key 維持原狀', async () => {
      const blockedBytes = Math.ceil(MAX_STORAGE_SIZE * QUOTA_THRESHOLDS.BLOCK)
      const store = createStorageMock({ bytesInUse: blockedBytes })
      const oldBooks = [makeBook('book-001')]
      const oldTags = [makeTag('t_local_1', '科幻', 'cat_local_1')]
      const oldCategories = [makeCategory('cat_local_1', '書籍類型')]
      store[STORAGE_KEYS.READMOO_BOOKS] = oldBooks
      store[STORAGE_KEYS.TAGS] = oldTags
      store[STORAGE_KEYS.TAG_CATEGORIES] = oldCategories

      const result = await TagStorageAdapter.mergeAllData({
        books: [makeBook('book-999')],
        tags: [makeTag('t_imp_1', '歷史', 'c_imp')],
        tagCategories: [makeCategory('c_imp', '閱讀清單')]
      })

      expect(result).toEqual({ success: false, error: 'quota_exceeded' })
      // 三 key 維持寫入前狀態（未讀算未寫）
      expect(store[STORAGE_KEYS.READMOO_BOOKS]).toEqual(oldBooks)
      expect(store[STORAGE_KEYS.TAGS]).toEqual(oldTags)
      expect(store[STORAGE_KEYS.TAG_CATEGORIES]).toEqual(oldCategories)
    })

    test('TC-M6 配額 normal 不誤擋', async () => {
      const normalBytes = Math.floor(MAX_STORAGE_SIZE * QUOTA_THRESHOLDS.WARNING * 0.5)
      const store = createStorageMock({ bytesInUse: normalBytes })
      store[STORAGE_KEYS.READMOO_BOOKS] = [makeBook('book-001')]
      store[STORAGE_KEYS.TAGS] = []
      store[STORAGE_KEYS.TAG_CATEGORIES] = []

      const result = await TagStorageAdapter.mergeAllData({
        books: [makeBook('book-999')],
        tags: [],
        tagCategories: []
      })

      expect(result.success).toBe(true)
      expect(store[STORAGE_KEYS.READMOO_BOOKS]).toHaveLength(2)
    })
  })

  // -------------------------------------------------------------------------
  // 測試群組 J：原子回滾（AC-12，對齊 IMP-C TC-S8/S9）
  // -------------------------------------------------------------------------
  describe('測試群組 J：原子回滾', () => {
    test('TC-M7 第二 key（tags）寫入失敗：三 key 全數回滾', async () => {
      let setCount = 0
      const store = createStorageMock({
        setHook: (items) => {
          if (Object.prototype.hasOwnProperty.call(items, STORAGE_KEYS.TAGS)) {
            setCount++
            // 僅在「寫入新 tags」階段失敗（回滾階段不再失敗）
            return setCount === 1
          }
          return false
        }
      })
      const oldBooks = [makeBook('book-001')]
      const oldTags = [makeTag('t_local_1', '科幻', 'cat_local_1')]
      const oldCategories = [makeCategory('cat_local_1', '書籍類型')]
      store[STORAGE_KEYS.READMOO_BOOKS] = oldBooks
      store[STORAGE_KEYS.TAGS] = oldTags
      store[STORAGE_KEYS.TAG_CATEGORIES] = oldCategories

      const result = await TagStorageAdapter.mergeAllData({
        books: [makeBook('book-999')],
        tags: [makeTag('t_imp_1', '歷史', 'c_imp')],
        tagCategories: [makeCategory('c_imp', '閱讀清單')]
      })

      expect(result).toEqual({ success: false, error: 'storage_error' })
      // 三 key 全數回滾至合併前快照（books 也回滾無部分更新）
      expect(store[STORAGE_KEYS.READMOO_BOOKS]).toEqual(oldBooks)
      expect(store[STORAGE_KEYS.TAGS]).toEqual(oldTags)
      expect(store[STORAGE_KEYS.TAG_CATEGORIES]).toEqual(oldCategories)
    })

    test('TC-M8 第三 key（tag_categories）寫入失敗：三 key 全數回滾', async () => {
      let setCount = 0
      const store = createStorageMock({
        setHook: (items) => {
          if (Object.prototype.hasOwnProperty.call(items, STORAGE_KEYS.TAG_CATEGORIES)) {
            setCount++
            return setCount === 1
          }
          return false
        }
      })
      const oldBooks = [makeBook('book-001')]
      const oldTags = [makeTag('t_local_1', '科幻', 'cat_local_1')]
      const oldCategories = [makeCategory('cat_local_1', '書籍類型')]
      store[STORAGE_KEYS.READMOO_BOOKS] = oldBooks
      store[STORAGE_KEYS.TAGS] = oldTags
      store[STORAGE_KEYS.TAG_CATEGORIES] = oldCategories

      const result = await TagStorageAdapter.mergeAllData({
        books: [makeBook('book-999')],
        tags: [makeTag('t_imp_1', '歷史', 'c_imp')],
        tagCategories: [makeCategory('c_imp', '閱讀清單')]
      })

      expect(result).toEqual({ success: false, error: 'storage_error' })
      expect(store[STORAGE_KEYS.READMOO_BOOKS]).toEqual(oldBooks)
      expect(store[STORAGE_KEYS.TAGS]).toEqual(oldTags)
      expect(store[STORAGE_KEYS.TAG_CATEGORIES]).toEqual(oldCategories)
    })

    test('TC-M9 回滾後資料可正常讀取', async () => {
      let setCount = 0
      const store = createStorageMock({
        setHook: (items) => {
          if (Object.prototype.hasOwnProperty.call(items, STORAGE_KEYS.TAGS)) {
            setCount++
            return setCount === 1
          }
          return false
        }
      })
      const oldTags = [makeTag('t_local_1', '科幻', 'cat_local_1')]
      const oldCategories = [makeCategory('cat_local_1', '書籍類型')]
      store[STORAGE_KEYS.READMOO_BOOKS] = [makeBook('book-001')]
      store[STORAGE_KEYS.TAGS] = oldTags
      store[STORAGE_KEYS.TAG_CATEGORIES] = oldCategories

      const result = await TagStorageAdapter.mergeAllData({
        books: [makeBook('book-999')],
        tags: [makeTag('t_imp_1', '歷史', 'c_imp')],
        tagCategories: [makeCategory('c_imp', '閱讀清單')]
      })
      expect(result.success).toBe(false)

      // 回滾後透過公開讀取 API 取回合併前舊資料
      const tagsAfter = await TagStorageAdapter.getAllTags()
      const categoriesAfter = await TagStorageAdapter.getAllTagCategories()
      expect(tagsAfter).toEqual(oldTags)
      expect(categoriesAfter).toEqual(oldCategories)
    })
  })

  // -------------------------------------------------------------------------
  // 測試群組 K：空匯入與並發（AC-13，§2.1）
  // -------------------------------------------------------------------------
  describe('測試群組 K：空匯入與並發', () => {
    test('TC-M10 空匯入結果等於本地原樣', async () => {
      const store = createStorageMock()
      const localBooks = [makeBook('book-001'), makeBook('book-002')]
      const localTags = [makeTag('t_local_1', '科幻', 'cat_local_1')]
      const localCategories = [makeCategory('cat_local_1', '書籍類型')]
      store[STORAGE_KEYS.READMOO_BOOKS] = localBooks
      store[STORAGE_KEYS.TAGS] = localTags
      store[STORAGE_KEYS.TAG_CATEGORIES] = localCategories

      const result = await TagStorageAdapter.mergeAllData({
        books: [],
        tags: [],
        tagCategories: []
      })

      expect(result.success).toBe(true)
      // counts 為本地原筆數
      expect(result.counts).toEqual({ books: 2, tags: 1, tagCategories: 1 })
      // 三 key 內容等於本地原值
      expect(store[STORAGE_KEYS.READMOO_BOOKS]).toEqual(localBooks)
      expect(store[STORAGE_KEYS.TAGS]).toEqual(localTags)
      expect(store[STORAGE_KEYS.TAG_CATEGORIES]).toEqual(localCategories)
    })

    test('TC-M11 operationLock 序列化：兩次合併不交錯依序疊加', async () => {
      const store = createStorageMock()
      store[STORAGE_KEYS.READMOO_BOOKS] = [makeBook('book-base')]
      store[STORAGE_KEYS.TAGS] = []
      store[STORAGE_KEYS.TAG_CATEGORIES] = []

      // 不 await 同時發起兩次合併（B 內容不同）
      const pA = TagStorageAdapter.mergeAllData({
        books: [makeBook('book-A')],
        tags: [],
        tagCategories: []
      })
      const pB = TagStorageAdapter.mergeAllData({
        books: [makeBook('book-B')],
        tags: [],
        tagCategories: []
      })

      const [resA, resB] = await Promise.all([pA, pB])

      // 兩次回傳皆成功
      expect(resA.success).toBe(true)
      expect(resB.success).toBe(true)
      // 最終 store 為兩次合併依序疊加結果（base + A + B，無交錯部分寫入）
      const finalIds = store[STORAGE_KEYS.READMOO_BOOKS].map(b => b.id)
      expect(finalIds).toEqual(expect.arrayContaining([
        'book-base', 'book-A', 'book-B'
      ]))
      expect(store[STORAGE_KEYS.READMOO_BOOKS]).toHaveLength(3)
    })
  })
})
