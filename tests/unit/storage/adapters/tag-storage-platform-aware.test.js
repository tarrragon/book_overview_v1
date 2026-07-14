/**
 * tag-storage-adapter platform-aware 讀寫測試
 * TDD Phase 3b — 1.6.0-W2-003.3（多書城 Tag 系統讀寫隔離）
 *
 * 測試對象：loadBooks / saveBooksWrapper 依 platformId 動態取 storage key，
 * 以及 book-tag 關聯操作（addTagToBook / removeTagFromBook / setBookTags /
 * getBooksByTag / getTagsForBook）與批量刪除、referential integrity、
 * replaceAllData / mergeAllData 在指定 platformId 下不跨書城污染。
 *
 * 規格來源：docs/work-logs/v1/v1.6/v1.6.0/tickets/1.6.0-W2-003.3.md
 * 測試遵循 test-assertion-design 規則：無計時硬門檻。
 */

const TagStorageAdapter = require('src/storage/adapters/tag-storage-adapter')

const STORAGE_KEYS = TagStorageAdapter.STORAGE_KEYS

// --- Chrome Storage Mock 工具（對齊 tag-storage-replace-all-data.test.js 慣例） ---

function createStorageMock () {
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
    Object.keys(items).forEach(key => {
      store[key] = JSON.parse(JSON.stringify(items[key]))
    })
    if (callback) callback()
  })

  chrome.storage.local.getBytesInUse.mockImplementation((keys, callback) => {
    callback(JSON.stringify(store).length)
  })

  return store
}

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

describe('tag-storage-adapter — platform-aware 讀寫', () => {
  beforeEach(() => {
    global.testUtils.cleanup()
  })

  describe('loadBooks / saveBooksWrapper 向後相容', () => {
    test('未傳 platformId 時操作 readmoo_books（既有行為不變）', async () => {
      const store = createStorageMock()
      store[STORAGE_KEYS.TAGS] = [makeTag('tag_1')]
      store[STORAGE_KEYS.READMOO_BOOKS] = [makeBook('r1')]

      const result = await TagStorageAdapter.addTagToBook('r1', 'tag_1')

      expect(result.success).toBe(true)
      expect(store.readmoo_books[0].tagIds).toEqual(['tag_1'])
      expect(store.kobo_books).toBeUndefined()
    })
  })

  describe('book-tag 關聯操作不跨書城污染', () => {
    test('addTagToBook 指定 platformId=kobo 只寫入 kobo_books，readmoo_books 不受影響', async () => {
      const store = createStorageMock()
      store[STORAGE_KEYS.TAGS] = [makeTag('tag_1')]
      store.readmoo_books = [makeBook('r1')]
      store.kobo_books = [makeBook('k1')]

      const result = await TagStorageAdapter.addTagToBook('k1', 'tag_1', 'kobo')

      expect(result.success).toBe(true)
      expect(store.kobo_books.find(b => b.id === 'k1').tagIds).toEqual(['tag_1'])
      expect(store.readmoo_books.find(b => b.id === 'r1').tagIds).toEqual([])
    })

    test('addTagToBook 對 kobo 平台無法命中同 id 的 readmoo 書籍', async () => {
      const store = createStorageMock()
      store[STORAGE_KEYS.TAGS] = [makeTag('tag_1')]
      store.readmoo_books = [makeBook('same-id')]
      store.kobo_books = []

      const result = await TagStorageAdapter.addTagToBook('same-id', 'tag_1', 'kobo')

      expect(result).toEqual({ success: false, error: 'book_not_found' })
      expect(store.readmoo_books.find(b => b.id === 'same-id').tagIds).toEqual([])
    })

    test('removeTagFromBook 指定 platformId 只影響對應書城', async () => {
      const store = createStorageMock()
      store.readmoo_books = [makeBook('r1', { tagIds: ['tag_1'] })]
      store.kobo_books = [makeBook('k1', { tagIds: ['tag_1'] })]

      await TagStorageAdapter.removeTagFromBook('k1', 'tag_1', 'kobo')

      expect(store.kobo_books.find(b => b.id === 'k1').tagIds).toEqual([])
      expect(store.readmoo_books.find(b => b.id === 'r1').tagIds).toEqual(['tag_1'])
    })

    test('setBookTags 指定 platformId 只影響對應書城', async () => {
      const store = createStorageMock()
      store[STORAGE_KEYS.TAGS] = [makeTag('tag_1'), makeTag('tag_2')]
      store.readmoo_books = [makeBook('r1')]
      store.kobo_books = [makeBook('k1')]

      await TagStorageAdapter.setBookTags('k1', ['tag_1', 'tag_2'], 'kobo')

      expect(store.kobo_books.find(b => b.id === 'k1').tagIds).toEqual(['tag_1', 'tag_2'])
      expect(store.readmoo_books.find(b => b.id === 'r1').tagIds).toEqual([])
    })

    test('getBooksByTag 指定 platformId 只查詢對應書城的書籍', async () => {
      const store = createStorageMock()
      store.readmoo_books = [makeBook('r1', { tagIds: ['tag_1'] })]
      store.kobo_books = [makeBook('k1', { tagIds: ['tag_1'] })]

      const koboResult = await TagStorageAdapter.getBooksByTag('tag_1', 'kobo')
      const readmooResult = await TagStorageAdapter.getBooksByTag('tag_1')

      expect(koboResult.map(b => b.id)).toEqual(['k1'])
      expect(readmooResult.map(b => b.id)).toEqual(['r1'])
    })

    test('getTagsForBook 指定 platformId 只讀取對應書城的書籍', async () => {
      const store = createStorageMock()
      store[STORAGE_KEYS.TAGS] = [makeTag('tag_1')]
      store.readmoo_books = [makeBook('same-id', { tagIds: ['tag_1'] })]
      store.kobo_books = [makeBook('same-id', { tagIds: [] })]

      const koboTags = await TagStorageAdapter.getTagsForBook('same-id', 'kobo')
      const readmooTags = await TagStorageAdapter.getTagsForBook('same-id')

      expect(koboTags).toEqual([])
      expect(readmooTags.map(t => t.id)).toEqual(['tag_1'])
    })
  })

  describe('批量操作與 referential integrity 不跨書城污染', () => {
    test('batchDeleteTags 指定 platformId 只從對應書城的書籍移除引用', async () => {
      const store = createStorageMock()
      store[STORAGE_KEYS.TAGS] = [makeTag('tag_1')]
      store.readmoo_books = [makeBook('r1', { tagIds: ['tag_1'] })]
      store.kobo_books = [makeBook('k1', { tagIds: ['tag_1'] })]

      await TagStorageAdapter.batchDeleteTags(['tag_1'], 'kobo')

      expect(store.kobo_books.find(b => b.id === 'k1').tagIds).toEqual([])
      expect(store.readmoo_books.find(b => b.id === 'r1').tagIds).toEqual(['tag_1'])
    })

    test('checkReferentialIntegrity 指定 platformId 只修復對應書城的書籍', async () => {
      const store = createStorageMock()
      store[STORAGE_KEYS.TAGS] = []
      store[STORAGE_KEYS.TAG_CATEGORIES] = []
      store.readmoo_books = [makeBook('r1', { tagIds: ['ghost_tag'] })]
      store.kobo_books = [makeBook('k1', { tagIds: ['ghost_tag'] })]

      await TagStorageAdapter.checkReferentialIntegrity('kobo')

      expect(store.kobo_books.find(b => b.id === 'k1').tagIds).toEqual([])
      expect(store.readmoo_books.find(b => b.id === 'r1').tagIds).toEqual(['ghost_tag'])
    })
  })

  describe('replaceAllData / mergeAllData 指定 platformId 不跨書城污染', () => {
    test('replaceAllData 指定 platformId=kobo 只覆蓋 kobo_books', async () => {
      const store = createStorageMock()
      store.readmoo_books = [makeBook('r1')]
      store.kobo_books = [makeBook('old-k1')]

      const result = await TagStorageAdapter.replaceAllData(
        { books: [makeBook('new-k1')], tags: [], tagCategories: [] },
        'kobo'
      )

      expect(result.success).toBe(true)
      expect(store.kobo_books.map(b => b.id)).toEqual(['new-k1'])
      expect(store.readmoo_books.map(b => b.id)).toEqual(['r1'])
    })

    test('mergeAllData 指定 platformId=kobo 只疊加 kobo_books', async () => {
      const store = createStorageMock()
      store.readmoo_books = [makeBook('r1')]
      store.kobo_books = [makeBook('k1')]

      const result = await TagStorageAdapter.mergeAllData(
        { books: [makeBook('k2')], tags: [], tagCategories: [] },
        'kobo'
      )

      expect(result.success).toBe(true)
      expect(store.kobo_books.map(b => b.id).sort()).toEqual(['k1', 'k2'])
      expect(store.readmoo_books.map(b => b.id)).toEqual(['r1'])
    })
  })
})
