/**
 * tag-storage-adapter.replaceAllData 覆蓋模式整批寫入測試
 * TDD Phase 3b — 0.19.0-W1-047.3（IMP-C，UC-04 匯入覆蓋模式與 storage 持久化）
 *
 * 測試對象：replaceAllData 公開 API
 *   - 覆蓋寫入（三 key 一併取代，舊資料不殘留）
 *   - 三 key 對應 STORAGE_KEYS 常數
 *   - books wrapper 結構保持
 *   - 空集合覆蓋語意（清空後載入 []）
 *   - 配額 blocked 攔截
 *   - 原子回滾（任一 key 寫入失敗回滾全部三 key）
 *   - operationLock 並發序列化
 *
 * 規格來源：docs/work-logs/v0/v0.19/v0.19.0/tickets/0.19.0-W1-047.3-feature-spec.md
 * 測試遵循 test-assertion-design 規則：無計時硬門檻；並發以執行順序 / 最終狀態斷言。
 */

const TagStorageAdapter = require('src/storage/adapters/tag-storage-adapter')

const STORAGE_KEYS = TagStorageAdapter.STORAGE_KEYS
const MAX_STORAGE_SIZE = TagStorageAdapter.MAX_STORAGE_SIZE
const QUOTA_THRESHOLDS = TagStorageAdapter.QUOTA_THRESHOLDS

// --- Chrome Storage Mock 工具 ---

/**
 * 建立具狀態的 chrome.storage.local mock
 * 業務需求：replaceAllData 測試需要真實的 get/set/getBytesInUse 行為
 *
 * @param {Object} [options]
 * @param {number} [options.bytesInUse] - 固定回傳的 getBytesInUse 值（用於配額測試）
 * @param {Function} [options.setHook] - set 攔截器：回傳 true 表示模擬寫入失敗
 * @returns {Object} store 物件（測試可直接讀寫斷言）
 */
function createStorageMock (options = {}) {
  const store = {}

  // 清除殘留的 lastError（可能被前一個測試設定）
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
    // setHook 模擬特定 key 寫入失敗（chrome.runtime.lastError）
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

const makeTag = (id, overrides = {}) => ({
  id,
  name: `標籤 ${id}`,
  categoryId: 'cat_1',
  isSystem: false,
  ...overrides
})

const makeCategory = (id, overrides = {}) => ({
  id,
  name: `分類 ${id}`,
  color: '#333333',
  isSystem: false,
  ...overrides
})

// ===========================================================================

describe('replaceAllData — 覆蓋模式整批寫入（UC-04 匯入）', () => {
  beforeEach(() => {
    global.testUtils.cleanup()
  })

  // -------------------------------------------------------------------------
  // Group A：覆蓋寫入成功（場景 1 / 3，AC-1, AC-2）
  // -------------------------------------------------------------------------
  describe('Group A：覆蓋寫入成功', () => {
    test('TC-S1 正常覆蓋：三 key 取代為匯入資料、舊資料不殘留', async () => {
      const store = createStorageMock()
      // 前置：store 預置舊資料
      store[STORAGE_KEYS.READMOO_BOOKS] = [makeBook('old1'), makeBook('old2')]
      store[STORAGE_KEYS.TAGS] = [makeTag('oldTag1')]
      store[STORAGE_KEYS.TAG_CATEGORIES] = [makeCategory('oldCat1')]

      expect(store[STORAGE_KEYS.READMOO_BOOKS]).toHaveLength(2)
      expect(store[STORAGE_KEYS.TAGS]).toHaveLength(1)
      expect(store[STORAGE_KEYS.TAG_CATEGORIES]).toHaveLength(1)

      const newBooks = [makeBook('n1'), makeBook('n2'), makeBook('n3')]
      const newTags = [makeTag('t1'), makeTag('t2')]
      const newCategories = [makeCategory('c1')]

      const result = await TagStorageAdapter.replaceAllData({
        books: newBooks,
        tags: newTags,
        tagCategories: newCategories
      })

      // 終點：三 key 內容等於匯入資料，舊資料完全不殘留
      expect(store[STORAGE_KEYS.READMOO_BOOKS]).toEqual(newBooks)
      expect(store[STORAGE_KEYS.TAGS]).toEqual(newTags)
      expect(store[STORAGE_KEYS.TAG_CATEGORIES]).toEqual(newCategories)
      // 回傳值含 success 與 counts
      expect(result).toEqual({
        success: true,
        counts: { books: 3, tags: 2, tagCategories: 1 }
      })
    })

    test('TC-S2 三 key 對應正確（STORAGE_KEYS 常數）', async () => {
      const store = createStorageMock()

      await TagStorageAdapter.replaceAllData({
        books: [makeBook('b1')],
        tags: [makeTag('t1')],
        tagCategories: [makeCategory('c1')]
      })

      // 驗證 key 名稱對應 STORAGE_KEYS 常數
      expect(store).toHaveProperty(STORAGE_KEYS.READMOO_BOOKS)
      expect(store).toHaveProperty(STORAGE_KEYS.TAGS)
      expect(store).toHaveProperty(STORAGE_KEYS.TAG_CATEGORIES)
      expect(STORAGE_KEYS.READMOO_BOOKS).toBe('readmoo_books')
      expect(STORAGE_KEYS.TAGS).toBe('tags')
      expect(STORAGE_KEYS.TAG_CATEGORIES).toBe('tag_categories')
    })

    test('TC-S3 books wrapper 結構保持（{ books, ... } 物件形式）', async () => {
      const store = createStorageMock()
      // 前置：readmoo_books 為 wrapper 物件形式
      store[STORAGE_KEYS.READMOO_BOOKS] = {
        books: [makeBook('old1')],
        extractionTimestamp: '2025-01-01T00:00:00Z'
      }

      const newBooks = [makeBook('n1'), makeBook('n2')]
      await TagStorageAdapter.replaceAllData({
        books: newBooks,
        tags: [],
        tagCategories: []
      })

      // saveBooksWrapper 保持原結構慣例：仍為 { books, ... } 物件形式
      const written = store[STORAGE_KEYS.READMOO_BOOKS]
      expect(Array.isArray(written)).toBe(false)
      expect(written).toHaveProperty('books')
      expect(written.books).toEqual(newBooks)
      // wrapper 既有欄位保留
      expect(written.extractionTimestamp).toBe('2025-01-01T00:00:00Z')
    })

    test('TC-S4 空書庫不視為錯誤（三 key 覆蓋為 []）', async () => {
      const store = createStorageMock()
      store[STORAGE_KEYS.READMOO_BOOKS] = [makeBook('old1')]
      store[STORAGE_KEYS.TAGS] = [makeTag('oldTag1')]
      store[STORAGE_KEYS.TAG_CATEGORIES] = [makeCategory('oldCat1')]

      const result = await TagStorageAdapter.replaceAllData({
        books: [],
        tags: [],
        tagCategories: []
      })

      expect(store[STORAGE_KEYS.READMOO_BOOKS]).toEqual([])
      expect(store[STORAGE_KEYS.TAGS]).toEqual([])
      expect(store[STORAGE_KEYS.TAG_CATEGORIES]).toEqual([])
      expect(result).toEqual({
        success: true,
        counts: { books: 0, tags: 0, tagCategories: 0 }
      })
    })
  })

  // -------------------------------------------------------------------------
  // Group B：空集合覆蓋語意（場景 2，AC-4）
  // -------------------------------------------------------------------------
  describe('Group B：空集合覆蓋語意', () => {
    test('TC-S5 僅含 books 時 tags/tagCategories 覆蓋為 []（非保留舊值）', async () => {
      const store = createStorageMock()
      // 前置：store 預置舊 tags / tag_categories
      store[STORAGE_KEYS.TAGS] = [makeTag('oldTag1'), makeTag('oldTag2')]
      store[STORAGE_KEYS.TAG_CATEGORIES] = [makeCategory('oldCat1')]

      expect(store[STORAGE_KEYS.TAGS].length).toBeGreaterThan(0)
      expect(store[STORAGE_KEYS.TAG_CATEGORIES].length).toBeGreaterThan(0)

      const newBooks = [makeBook('n1'), makeBook('n2')]
      await TagStorageAdapter.replaceAllData({
        books: newBooks,
        tags: [],
        tagCategories: []
      })

      // 覆蓋為空，非保留舊值
      expect(store[STORAGE_KEYS.TAGS]).toEqual([])
      expect(store[STORAGE_KEYS.TAG_CATEGORIES]).toEqual([])
      expect(store[STORAGE_KEYS.READMOO_BOOKS]).toEqual(newBooks)
    })
  })

  // -------------------------------------------------------------------------
  // Group C：配額攔截（場景 4，AC-6）
  // -------------------------------------------------------------------------
  describe('Group C：配額攔截', () => {
    test('TC-S6 配額 blocked 攔截：不寫入、store 維持寫入前狀態', async () => {
      // bytesInUse 達 BLOCK 門檻（0.95）
      const blockedBytes = Math.ceil(MAX_STORAGE_SIZE * QUOTA_THRESHOLDS.BLOCK)
      const store = createStorageMock({ bytesInUse: blockedBytes })
      // 前置：store 預置舊資料
      store[STORAGE_KEYS.READMOO_BOOKS] = [makeBook('old1')]
      store[STORAGE_KEYS.TAGS] = [makeTag('oldTag1')]
      store[STORAGE_KEYS.TAG_CATEGORIES] = [makeCategory('oldCat1')]

      const result = await TagStorageAdapter.replaceAllData({
        books: [makeBook('n1')],
        tags: [makeTag('t1')],
        tagCategories: [makeCategory('c1')]
      })

      expect(result).toEqual({ success: false, error: 'quota_exceeded' })
      // 三 key 維持寫入前狀態（store 未被修改）
      expect(store[STORAGE_KEYS.READMOO_BOOKS]).toEqual([makeBook('old1')])
      expect(store[STORAGE_KEYS.TAGS]).toEqual([makeTag('oldTag1')])
      expect(store[STORAGE_KEYS.TAG_CATEGORIES]).toEqual([makeCategory('oldCat1')])
    })

    test('TC-S7 配額 normal 不誤擋正常寫入', async () => {
      // bytesInUse 低於 WARNING 門檻
      const normalBytes = Math.floor(MAX_STORAGE_SIZE * QUOTA_THRESHOLDS.WARNING * 0.5)
      const store = createStorageMock({ bytesInUse: normalBytes })

      const result = await TagStorageAdapter.replaceAllData({
        books: [makeBook('n1')],
        tags: [],
        tagCategories: []
      })

      expect(result.success).toBe(true)
      expect(store[STORAGE_KEYS.READMOO_BOOKS]).toEqual([makeBook('n1')])
    })
  })

  // -------------------------------------------------------------------------
  // Group D：原子回滾（場景 5，AC-5）
  // -------------------------------------------------------------------------
  describe('Group D：原子回滾', () => {
    test('TC-S8 第二個 key（tags）寫入失敗：三 key 全數回滾', async () => {
      let setCount = 0
      // setHook：第二次 set（寫 tags）模擬失敗
      const store = createStorageMock({
        setHook: (items) => {
          // readmoo_books 為第一次寫入，tags 為第二次
          if (Object.prototype.hasOwnProperty.call(items, STORAGE_KEYS.TAGS)) {
            setCount++
            // 僅在「寫入新 tags」階段失敗（回滾階段不再失敗）
            return setCount === 1
          }
          return false
        }
      })
      // 前置：store 預置舊三 key 資料
      const oldBooks = [makeBook('old1')]
      const oldTags = [makeTag('oldTag1')]
      const oldCategories = [makeCategory('oldCat1')]
      store[STORAGE_KEYS.READMOO_BOOKS] = oldBooks
      store[STORAGE_KEYS.TAGS] = oldTags
      store[STORAGE_KEYS.TAG_CATEGORIES] = oldCategories

      const result = await TagStorageAdapter.replaceAllData({
        books: [makeBook('n1'), makeBook('n2')],
        tags: [makeTag('t1')],
        tagCategories: [makeCategory('c1')]
      })

      expect(result).toEqual({ success: false, error: 'storage_error' })
      // 三 key 皆回滾至寫入前快照（books 也回滾，無部分更新）
      expect(store[STORAGE_KEYS.READMOO_BOOKS]).toEqual(oldBooks)
      expect(store[STORAGE_KEYS.TAGS]).toEqual(oldTags)
      expect(store[STORAGE_KEYS.TAG_CATEGORIES]).toEqual(oldCategories)
    })

    test('TC-S9 第三個 key（tag_categories）寫入失敗：三 key 全數回滾', async () => {
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
      const oldBooks = [makeBook('old1')]
      const oldTags = [makeTag('oldTag1')]
      const oldCategories = [makeCategory('oldCat1')]
      store[STORAGE_KEYS.READMOO_BOOKS] = oldBooks
      store[STORAGE_KEYS.TAGS] = oldTags
      store[STORAGE_KEYS.TAG_CATEGORIES] = oldCategories

      const result = await TagStorageAdapter.replaceAllData({
        books: [makeBook('n1')],
        tags: [makeTag('t1')],
        tagCategories: [makeCategory('c1')]
      })

      expect(result).toEqual({ success: false, error: 'storage_error' })
      expect(store[STORAGE_KEYS.READMOO_BOOKS]).toEqual(oldBooks)
      expect(store[STORAGE_KEYS.TAGS]).toEqual(oldTags)
      expect(store[STORAGE_KEYS.TAG_CATEGORIES]).toEqual(oldCategories)
    })

    test('TC-S10 回滾後資料可正常讀取（storage 處於一致可用狀態）', async () => {
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
      const oldTags = [makeTag('oldTag1'), makeTag('oldTag2')]
      const oldCategories = [makeCategory('oldCat1')]
      store[STORAGE_KEYS.READMOO_BOOKS] = [makeBook('old1')]
      store[STORAGE_KEYS.TAGS] = oldTags
      store[STORAGE_KEYS.TAG_CATEGORIES] = oldCategories

      const result = await TagStorageAdapter.replaceAllData({
        books: [makeBook('n1')],
        tags: [makeTag('t1')],
        tagCategories: [makeCategory('c1')]
      })
      expect(result.success).toBe(false)

      // 回滾後透過公開讀取 API 可取回舊資料
      const tagsAfter = await TagStorageAdapter.getAllTags()
      const categoriesAfter = await TagStorageAdapter.getAllTagCategories()
      expect(tagsAfter).toEqual(oldTags)
      expect(categoriesAfter).toEqual(oldCategories)
    })
  })

  // -------------------------------------------------------------------------
  // Group E：並發序列化（operationLock，§2.1 設計約束）
  // -------------------------------------------------------------------------
  describe('Group E：並發序列化', () => {
    test('TC-S11 operationLock 序列化：兩次呼叫不交錯、最終為後完成者資料', async () => {
      const store = createStorageMock()

      const booksA = [makeBook('A1'), makeBook('A2')]
      const booksB = [makeBook('B1')]

      // 不 await 同時發起兩次呼叫
      const pA = TagStorageAdapter.replaceAllData({
        books: booksA,
        tags: [makeTag('tA')],
        tagCategories: [makeCategory('cA')]
      })
      const pB = TagStorageAdapter.replaceAllData({
        books: booksB,
        tags: [makeTag('tB')],
        tagCategories: [makeCategory('cB')]
      })

      const [resA, resB] = await Promise.all([pA, pB])

      // 兩次回傳皆成功
      expect(resA.success).toBe(true)
      expect(resB.success).toBe(true)
      // 最終 store 為後完成者（B）的資料——operationLock 以 queue 串接，
      // B 在 A resolve 後才執行，最終狀態為 B
      expect(store[STORAGE_KEYS.READMOO_BOOKS]).toEqual(booksB)
      expect(store[STORAGE_KEYS.TAGS]).toEqual([makeTag('tB')])
      expect(store[STORAGE_KEYS.TAG_CATEGORIES]).toEqual([makeCategory('cB')])
    })
  })
})
