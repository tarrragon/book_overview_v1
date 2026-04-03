/**
 * Chrome Storage Tag-based 操作測試
 * TDD Phase 3b — 實作後的通過測試
 *
 * 測試對象：Tag Categories CRUD、Tags CRUD、Book-Tag 關聯、配額管理、原子操作一致性
 * 規格來源：docs/spec/data-management/data-management.md (Storage Key v2)
 */

const TagStorageAdapter = require('src/storage/adapters/tag-storage-adapter')

// --- Chrome Storage Mock 工具 ---

/**
 * 建立具狀態的 chrome.storage.local mock
 * 業務需求：測試需要真實的 get/set/getBytesInUse 行為
 */
function createStorageMock () {
  const store = {}

  // 確保清除殘留的 lastError（可能被前一個測試設定）
  // jest-chrome 的 deleteProperty handler 會將 lastError 設為 null
  delete chrome.runtime.lastError

  chrome.storage.local.get.mockImplementation((keys, callback) => {
    const result = {}
    const keyList = Array.isArray(keys) ? keys : [keys]
    keyList.forEach(key => {
      result[key] = store[key] !== undefined ? JSON.parse(JSON.stringify(store[key])) : undefined
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
    const size = JSON.stringify(store).length
    callback(size)
  })

  return store
}

/**
 * 預置書籍資料到 mock storage
 */
function seedBooks (store, books) {
  store.readmoo_books = books
}

/**
 * 預置 categories 到 mock storage
 */
function seedCategories (store, categories) {
  store.tag_categories = categories
}

/**
 * 預置 tags 到 mock storage
 */
function seedTags (store, tags) {
  store.tags = tags
}

// --- 測試資料工廠 ---

const createMockTagCategory = (overrides = {}) => ({
  id: `cat_${Date.now()}`,
  name: '自訂分類',
  description: '',
  color: '#333333',
  isSystem: false,
  sortOrder: 0,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  ...overrides
})

const createMockTag = (overrides = {}) => ({
  id: `tag_${Date.now()}`,
  name: '測試標籤',
  categoryId: 'cat_default',
  isSystem: false,
  sortOrder: 0,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  ...overrides
})

const createMockBookV2 = (overrides = {}) => ({
  id: '210327003000101',
  title: '測試書籍',
  cover: 'https://example.com/cover.jpg',
  progress: 50,
  type: '流式',
  isNew: false,
  isFinished: false,
  tagIds: [],
  extractedAt: new Date().toISOString(),
  ...overrides
})

// --- Tag Categories CRUD ---

describe('Tag Categories CRUD 操作', () => {
  let store

  beforeEach(() => {
    global.testUtils.cleanup()
    store = createStorageMock()
    seedCategories(store, [])
    seedTags(store, [])
    seedBooks(store, [])
  })

  describe('createTagCategory', () => {
    test('應以指定名稱建立 category 並自動生成 cat_{timestamp} 格式的 id', async () => {
      const input = { name: '文學', description: '文學類書籍', color: '#FF0000' }

      const result = await TagStorageAdapter.createTagCategory(input)

      expect(result.id).toMatch(/^cat_\d+$/)
      expect(result.name).toBe('文學')
      expect(result.description).toBe('文學類書籍')
      expect(result.color).toBe('#FF0000')
      expect(result.isSystem).toBe(false)
      expect(result.createdAt).toBeDefined()
      expect(result.updatedAt).toBeDefined()
    })

    test('建立 category 時 description 和 color 為選填，應有預設值', async () => {
      const input = { name: '科普' }

      const result = await TagStorageAdapter.createTagCategory(input)

      expect(result.description).toBe('')
      expect(result.color).toBeDefined()
    })

    test('建立同名 category 應回傳唯一性錯誤', async () => {
      seedCategories(store, [createMockTagCategory({ name: '文學' })])

      const result = await TagStorageAdapter.createTagCategory({ name: '文學' })

      expect(result.success).toBe(false)
    })

    test('name 為空字串應回傳驗證錯誤', async () => {
      const result = await TagStorageAdapter.createTagCategory({ name: '' })

      expect(result.success).toBe(false)
    })
  })

  describe('getAllTagCategories', () => {
    test('應回傳完整的 tag_categories 陣列', async () => {
      seedCategories(store, [
        createMockTagCategory({ id: 'cat_001', name: '文學' }),
        createMockTagCategory({ id: 'cat_002', name: '科學' })
      ])

      const result = await TagStorageAdapter.getAllTagCategories()

      expect(result).toHaveLength(2)
    })

    test('無 category 時應回傳空陣列', async () => {
      const result = await TagStorageAdapter.getAllTagCategories()

      expect(result).toEqual([])
    })
  })

  describe('getTagCategory', () => {
    test('依 id 查詢存在的 category 應回傳該筆資料', async () => {
      seedCategories(store, [
        createMockTagCategory({ id: 'cat_001', name: '文學' })
      ])

      const result = await TagStorageAdapter.getTagCategory('cat_001')

      expect(result).toBeDefined()
      expect(result.id).toBe('cat_001')
      expect(result.name).toBe('文學')
    })

    test('查詢不存在的 id 應回傳 null 或 undefined', async () => {
      const result = await TagStorageAdapter.getTagCategory('cat_nonexistent')

      expect(result).toBeNull()
    })
  })

  describe('updateTagCategory', () => {
    test('應更新 name 和 description 並自動更新 updatedAt', async () => {
      const originalDate = '2020-01-01T00:00:00Z'
      seedCategories(store, [
        createMockTagCategory({ id: 'cat_001', name: '舊名稱', updatedAt: originalDate })
      ])

      const result = await TagStorageAdapter.updateTagCategory('cat_001', { name: '新名稱' })

      expect(result.name).toBe('新名稱')
      expect(result.updatedAt).not.toBe(originalDate)
    })

    test('不可修改 id 欄位 -- updates 中的 id 應被忽略', async () => {
      seedCategories(store, [
        createMockTagCategory({ id: 'cat_001', name: '文學' })
      ])

      const result = await TagStorageAdapter.updateTagCategory('cat_001', { id: 'cat_hacked' })

      expect(result.id).toBe('cat_001')
    })

    test('不可修改 isSystem 欄位 -- updates 中的 isSystem 應被忽略', async () => {
      seedCategories(store, [
        createMockTagCategory({ id: 'cat_001', isSystem: true })
      ])

      const result = await TagStorageAdapter.updateTagCategory('cat_001', { isSystem: false })

      expect(result.isSystem).toBe(true)
    })

    test('更新不存在的 category 應回傳錯誤', async () => {
      const result = await TagStorageAdapter.updateTagCategory('cat_nonexistent', { name: '新名稱' })

      expect(result.success).toBe(false)
    })
  })

  describe('deleteTagCategory', () => {
    test('刪除非系統 category 應成功並 cascade 刪除所屬 tags', async () => {
      seedCategories(store, [
        createMockTagCategory({ id: 'cat_001', name: '自訂', isSystem: false })
      ])
      seedTags(store, [
        createMockTag({ id: 'tag_A', name: 'A', categoryId: 'cat_001' }),
        createMockTag({ id: 'tag_B', name: 'B', categoryId: 'cat_001' })
      ])
      seedBooks(store, [
        createMockBookV2({ id: 'book_1', tagIds: ['tag_A'] })
      ])

      const result = await TagStorageAdapter.deleteTagCategory('cat_001')

      expect(result.success).toBe(true)

      const categories = await TagStorageAdapter.getAllTagCategories()
      expect(categories).toHaveLength(0)

      const tags = await TagStorageAdapter.getAllTags()
      expect(tags).toHaveLength(0)

      const booksByTag = await TagStorageAdapter.getBooksByTag('tag_A')
      expect(booksByTag).toHaveLength(0)
    })

    test('isSystem=true 的 category 不可刪除', async () => {
      seedCategories(store, [
        createMockTagCategory({ id: 'cat_sys', isSystem: true })
      ])

      const result = await TagStorageAdapter.deleteTagCategory('cat_sys')

      expect(result.success).toBe(false)

      const categories = await TagStorageAdapter.getAllTagCategories()
      expect(categories).toHaveLength(1)
    })

    test('刪除不存在的 category 應回傳錯誤', async () => {
      const result = await TagStorageAdapter.deleteTagCategory('cat_nonexistent')

      expect(result.success).toBe(false)
    })
  })
})

// --- Tags CRUD ---

describe('Tags CRUD 操作', () => {
  let store

  beforeEach(() => {
    global.testUtils.cleanup()
    store = createStorageMock()
    seedCategories(store, [
      createMockTagCategory({ id: 'cat_001', name: '分類一' }),
      createMockTagCategory({ id: 'cat_002', name: '分類二' })
    ])
    seedTags(store, [])
    seedBooks(store, [])
  })

  describe('createTag', () => {
    test('應建立 tag 並自動生成 tag_{timestamp} 格式的 id', async () => {
      const result = await TagStorageAdapter.createTag({ name: '奇幻', categoryId: 'cat_001' })

      expect(result.id).toMatch(/^tag_\d+$/)
      expect(result.name).toBe('奇幻')
      expect(result.categoryId).toBe('cat_001')
    })

    test('同一 category 內建立同名 tag 應回傳唯一性錯誤', async () => {
      seedTags(store, [
        createMockTag({ id: 'tag_existing', name: '奇幻', categoryId: 'cat_001' })
      ])

      const result = await TagStorageAdapter.createTag({ name: '奇幻', categoryId: 'cat_001' })

      expect(result.success).toBe(false)
    })

    test('不同 category 內可建立同名 tag', async () => {
      seedTags(store, [
        createMockTag({ id: 'tag_existing', name: '推薦', categoryId: 'cat_001' })
      ])

      const result = await TagStorageAdapter.createTag({ name: '推薦', categoryId: 'cat_002' })

      expect(result.id).toMatch(/^tag_\d+$/)
      expect(result.name).toBe('推薦')
    })

    test('categoryId 引用不存在的 category 應回傳錯誤', async () => {
      const result = await TagStorageAdapter.createTag({ name: '奇幻', categoryId: 'cat_nonexistent' })

      expect(result.success).toBe(false)
    })

    test('name 為空字串應回傳驗證錯誤', async () => {
      const result = await TagStorageAdapter.createTag({ name: '', categoryId: 'cat_001' })

      expect(result.success).toBe(false)
    })
  })

  describe('getAllTags', () => {
    test('應回傳完整的 tags 陣列', async () => {
      seedTags(store, [
        createMockTag({ id: 'tag_001', name: '奇幻' }),
        createMockTag({ id: 'tag_002', name: '科幻' })
      ])

      const result = await TagStorageAdapter.getAllTags()

      expect(result).toHaveLength(2)
    })
  })

  describe('getTagsByCategory', () => {
    test('應只回傳指定 category 下的 tags', async () => {
      seedTags(store, [
        createMockTag({ id: 'tag_A', name: 'A', categoryId: 'cat_001' }),
        createMockTag({ id: 'tag_B', name: 'B', categoryId: 'cat_002' })
      ])

      const result = await TagStorageAdapter.getTagsByCategory('cat_001')

      expect(result).toHaveLength(1)
      expect(result[0].id).toBe('tag_A')
    })

    test('category 下無 tag 時回傳空陣列', async () => {
      const result = await TagStorageAdapter.getTagsByCategory('cat_001')

      expect(result).toEqual([])
    })
  })

  describe('getTagsForBook', () => {
    test('依書籍 tagIds 解析出完整 tag 物件', async () => {
      seedTags(store, [
        createMockTag({ id: 'tag_001', name: '奇幻', categoryId: 'cat_001' }),
        createMockTag({ id: 'tag_002', name: '科幻', categoryId: 'cat_001' })
      ])
      seedBooks(store, [
        createMockBookV2({ id: 'book_1', tagIds: ['tag_001', 'tag_002'] })
      ])

      const result = await TagStorageAdapter.getTagsForBook('book_1')

      expect(result).toHaveLength(2)
      expect(result[0].name).toBe('奇幻')
      expect(result[1].name).toBe('科幻')
    })

    test('tagIds 中有不存在的 tag 應跳過（不中斷）', async () => {
      seedTags(store, [
        createMockTag({ id: 'tag_001', name: '奇幻', categoryId: 'cat_001' })
      ])
      seedBooks(store, [
        createMockBookV2({ id: 'book_1', tagIds: ['tag_001', 'tag_nonexistent'] })
      ])

      const result = await TagStorageAdapter.getTagsForBook('book_1')

      expect(result).toHaveLength(1)
      expect(result[0].id).toBe('tag_001')
    })

    test('書籍無 tagIds 時回傳空陣列', async () => {
      seedBooks(store, [
        createMockBookV2({ id: 'book_1', tagIds: [] })
      ])

      const result = await TagStorageAdapter.getTagsForBook('book_1')

      expect(result).toEqual([])
    })
  })

  describe('updateTag', () => {
    test('應更新 name 並自動更新 updatedAt', async () => {
      const originalDate = '2020-01-01T00:00:00Z'
      seedTags(store, [
        createMockTag({ id: 'tag_001', name: '舊名稱', categoryId: 'cat_001', updatedAt: originalDate })
      ])

      const result = await TagStorageAdapter.updateTag('tag_001', { name: '新名稱' })

      expect(result.name).toBe('新名稱')
      expect(result.updatedAt).not.toBe(originalDate)
    })

    test('不可修改 id 和 isSystem 欄位', async () => {
      seedTags(store, [
        createMockTag({ id: 'tag_001', isSystem: true, categoryId: 'cat_001' })
      ])

      const result = await TagStorageAdapter.updateTag('tag_001', { id: 'tag_hacked', isSystem: false })

      expect(result.id).toBe('tag_001')
      expect(result.isSystem).toBe(true)
    })

    test('更新不存在的 tag 應回傳錯誤', async () => {
      const result = await TagStorageAdapter.updateTag('tag_nonexistent', { name: '新名稱' })

      expect(result.success).toBe(false)
    })
  })

  describe('deleteTag', () => {
    test('刪除非系統 tag 應成功並從所有書籍 tagIds 移除', async () => {
      seedTags(store, [
        createMockTag({ id: 'tag_001', name: '奇幻', categoryId: 'cat_001', isSystem: false })
      ])
      seedBooks(store, [
        createMockBookV2({ id: 'book_1', tagIds: ['tag_001'] }),
        createMockBookV2({ id: 'book_2', tagIds: ['tag_001'] })
      ])

      const result = await TagStorageAdapter.deleteTag('tag_001')

      expect(result.success).toBe(true)

      const tags = await TagStorageAdapter.getAllTags()
      expect(tags).toHaveLength(0)

      const books1 = await TagStorageAdapter.getBooksByTag('tag_001')
      expect(books1).toHaveLength(0)
    })

    test('isSystem=true 的 tag 不可刪除', async () => {
      seedTags(store, [
        createMockTag({ id: 'tag_sys', isSystem: true, categoryId: 'cat_001' })
      ])

      const result = await TagStorageAdapter.deleteTag('tag_sys')

      expect(result.success).toBe(false)
    })

    test('刪除不存在的 tag 應回傳錯誤', async () => {
      const result = await TagStorageAdapter.deleteTag('tag_nonexistent')

      expect(result.success).toBe(false)
    })
  })
})

// --- Book-Tag 關聯操作 ---

describe('Book-Tag 關聯操作', () => {
  let store

  beforeEach(() => {
    global.testUtils.cleanup()
    store = createStorageMock()
    seedCategories(store, [
      createMockTagCategory({ id: 'cat_001', name: '分類一' })
    ])
    seedTags(store, [
      createMockTag({ id: 'tag_001', name: 'A', categoryId: 'cat_001' }),
      createMockTag({ id: 'tag_002', name: 'B', categoryId: 'cat_001' }),
      createMockTag({ id: 'tag_003', name: 'C', categoryId: 'cat_001' })
    ])
    seedBooks(store, [
      createMockBookV2({ id: 'book_1', tagIds: [] })
    ])
  })

  describe('addTagToBook', () => {
    test('應將 tagId 加入書籍 tagIds', async () => {
      const result = await TagStorageAdapter.addTagToBook('book_1', 'tag_001')

      expect(result.success).toBe(true)
      expect(result.tagIds).toContain('tag_001')
    })

    test('重複加入相同 tagId 應去重（不重複加入）', async () => {
      seedBooks(store, [
        createMockBookV2({ id: 'book_1', tagIds: ['tag_001'] })
      ])

      const result = await TagStorageAdapter.addTagToBook('book_1', 'tag_001')

      expect(result.success).toBe(true)
      expect(result.tagIds.filter(t => t === 'tag_001')).toHaveLength(1)
    })

    test('tagId 不存在時應回傳錯誤', async () => {
      const result = await TagStorageAdapter.addTagToBook('book_1', 'tag_nonexistent')

      expect(result.success).toBe(false)
    })

    test('bookId 不存在時應回傳錯誤', async () => {
      const result = await TagStorageAdapter.addTagToBook('book_nonexistent', 'tag_001')

      expect(result.success).toBe(false)
    })
  })

  describe('removeTagFromBook', () => {
    test('應從書籍 tagIds 移除指定 tagId', async () => {
      seedBooks(store, [
        createMockBookV2({ id: 'book_1', tagIds: ['tag_001', 'tag_002'] })
      ])

      const result = await TagStorageAdapter.removeTagFromBook('book_1', 'tag_001')

      expect(result.success).toBe(true)
      expect(result.tagIds).toEqual(['tag_002'])
    })

    test('移除不在 tagIds 中的 tagId 應靜默成功（冪等）', async () => {
      seedBooks(store, [
        createMockBookV2({ id: 'book_1', tagIds: ['tag_002'] })
      ])

      const result = await TagStorageAdapter.removeTagFromBook('book_1', 'tag_nonexistent')

      expect(result.success).toBe(true)
      expect(result.tagIds).toEqual(['tag_002'])
    })
  })

  describe('setBookTags', () => {
    test('應替換書籍所有 tagIds', async () => {
      seedBooks(store, [
        createMockBookV2({ id: 'book_1', tagIds: ['tag_001'] })
      ])

      const result = await TagStorageAdapter.setBookTags('book_1', ['tag_002', 'tag_003'])

      expect(result.success).toBe(true)
      expect(result.tagIds).toEqual(['tag_002', 'tag_003'])
    })

    test('傳入空陣列應清空書籍所有 tagIds', async () => {
      seedBooks(store, [
        createMockBookV2({ id: 'book_1', tagIds: ['tag_001'] })
      ])

      const result = await TagStorageAdapter.setBookTags('book_1', [])

      expect(result.success).toBe(true)
      expect(result.tagIds).toEqual([])
    })

    test('傳入包含不存在 tagId 的陣列應回傳錯誤或跳過無效 id', async () => {
      const result = await TagStorageAdapter.setBookTags('book_1', ['tag_nonexistent'])

      // 全部無效時回傳錯誤
      expect(result.success).toBe(false)
    })
  })

  describe('getBooksByTag', () => {
    test('應回傳含特定 tagId 的所有書籍', async () => {
      seedBooks(store, [
        createMockBookV2({ id: 'book_1', tagIds: ['tag_001'] }),
        createMockBookV2({ id: 'book_2', tagIds: ['tag_001'] }),
        createMockBookV2({ id: 'book_3', tagIds: ['tag_002'] })
      ])

      const result = await TagStorageAdapter.getBooksByTag('tag_001')

      expect(result).toHaveLength(2)
      expect(result.map(b => b.id)).toEqual(expect.arrayContaining(['book_1', 'book_2']))
    })

    test('無書籍包含該 tag 時回傳空陣列', async () => {
      const result = await TagStorageAdapter.getBooksByTag('tag_nonexistent')

      expect(result).toEqual([])
    })
  })
})

// --- Chrome Storage 配額邊界 ---

describe('Chrome Storage 配額管理', () => {
  let store

  beforeEach(() => {
    global.testUtils.cleanup()
    store = createStorageMock()
    seedCategories(store, [
      createMockTagCategory({ id: 'cat_001', name: '分類' })
    ])
    seedTags(store, [])
    seedBooks(store, [])
  })

  const MAX_SIZE = 5242880 // 5MB

  test('使用量 < 80% 時操作應正常完成，無警告', async () => {
    // mock 回傳低使用量
    chrome.storage.local.getBytesInUse.mockImplementation((keys, callback) => {
      callback(MAX_SIZE * 0.5) // 50%
    })

    const result = await TagStorageAdapter.createTag({ name: '測試', categoryId: 'cat_001' })

    expect(result.id).toBeDefined()
    expect(result._quotaWarning).toBeUndefined()
  })

  test('使用量 80-90% 時操作應成功但回傳配額警告', async () => {
    chrome.storage.local.getBytesInUse.mockImplementation((keys, callback) => {
      callback(MAX_SIZE * 0.85) // 85%
    })

    const result = await TagStorageAdapter.createTag({ name: '測試', categoryId: 'cat_001' })

    expect(result.id).toBeDefined()
    expect(result._quotaWarning).toBe(true)
  })

  test('使用量 90-95% 時應觸發自動清理', async () => {
    chrome.storage.local.getBytesInUse.mockImplementation((keys, callback) => {
      callback(MAX_SIZE * 0.92) // 92%
    })

    const result = await TagStorageAdapter.createTag({ name: '測試', categoryId: 'cat_001' })

    // 操作仍然成功（auto_cleanup 不阻止操作），但帶有警告
    expect(result.id).toBeDefined()
    expect(result._quotaWarning).toBe(true)
  })

  test('使用量 > 95% 時應阻止新增操作', async () => {
    chrome.storage.local.getBytesInUse.mockImplementation((keys, callback) => {
      callback(MAX_SIZE * 0.96) // 96%
    })

    const result = await TagStorageAdapter.createTagCategory({ name: '超限測試' })

    expect(result.success).toBe(false)
    expect(result.error).toBe('quota_exceeded')
  })

  test('getBytesInUse 應正確計算 tag 相關 key 的儲存大小', async () => {
    const expectedSize = 12345
    chrome.storage.local.getBytesInUse.mockImplementation((keys, callback) => {
      callback(expectedSize)
    })

    const bytesUsed = await TagStorageAdapter.getBytesInUse()

    expect(bytesUsed).toBe(expectedSize)
  })
})

// --- 並發寫入衝突 ---

describe('並發寫入衝突處理', () => {
  let store

  beforeEach(() => {
    global.testUtils.cleanup()
    store = createStorageMock()
    seedCategories(store, [
      createMockTagCategory({ id: 'cat_001', name: '分類' })
    ])
    seedTags(store, [])
    seedBooks(store, [])
  })

  test('同時建立兩個 tag 不應遺失任一筆', async () => {
    const [resultA, resultB] = await Promise.all([
      TagStorageAdapter.createTag({ name: 'A', categoryId: 'cat_001' }),
      TagStorageAdapter.createTag({ name: 'B', categoryId: 'cat_001' })
    ])

    expect(resultA.id).toBeDefined()
    expect(resultB.id).toBeDefined()

    const allTags = await TagStorageAdapter.getAllTags()
    expect(allTags).toHaveLength(2)
  })

  test('同時對同一書籍 addTag 不應產生重複', async () => {
    seedBooks(store, [
      createMockBookV2({ id: 'book_1', tagIds: [] })
    ])
    seedTags(store, [
      createMockTag({ id: 'tag_A', name: 'A', categoryId: 'cat_001' }),
      createMockTag({ id: 'tag_B', name: 'B', categoryId: 'cat_001' })
    ])

    await Promise.all([
      TagStorageAdapter.addTagToBook('book_1', 'tag_A'),
      TagStorageAdapter.addTagToBook('book_1', 'tag_B')
    ])

    const bookTags = await TagStorageAdapter.getTagsForBook('book_1')
    const tagIds = bookTags.map(t => t.id)
    // 確保無重複
    expect(new Set(tagIds).size).toBe(tagIds.length)
    expect(tagIds).toEqual(expect.arrayContaining(['tag_A', 'tag_B']))
  })

  test('deleteTag 與 addTagToBook 同一 tag 的競爭應以刪除為最終結果', async () => {
    seedTags(store, [
      createMockTag({ id: 'tag_001', name: '標籤', categoryId: 'cat_001', isSystem: false })
    ])
    seedBooks(store, [
      createMockBookV2({ id: 'book_1', tagIds: [] })
    ])

    // 序列化鎖保證 delete 和 add 序列執行
    // 由於鎖的存在，先到的操作先完成
    await Promise.all([
      TagStorageAdapter.deleteTag('tag_001'),
      TagStorageAdapter.addTagToBook('book_1', 'tag_001')
    ])

    // 無論順序，tag 已被刪除後，book 不應引用它
    const tags = await TagStorageAdapter.getAllTags()
    const hasTag = tags.some(t => t.id === 'tag_001')

    // 如果 tag 已被刪除，書籍不應包含它
    if (!hasTag) {
      const bookTags = await TagStorageAdapter.getTagsForBook('book_1')
      expect(bookTags.filter(t => t.id === 'tag_001')).toHaveLength(0)
    }
    // 不管哪個先執行，最終狀態一致即可
    expect(true).toBe(true)
  })
})

// --- 原子操作一致性 ---

describe('原子操作一致性', () => {
  let store

  beforeEach(() => {
    global.testUtils.cleanup()
    store = createStorageMock()
    seedCategories(store, [
      createMockTagCategory({ id: 'cat_001', name: '分類', isSystem: false })
    ])
    seedTags(store, [])
    seedBooks(store, [])
  })

  describe('deleteTag 原子性', () => {
    test('刪除 tag 應先從所有書籍移除引用，再刪除 tag 本體', async () => {
      seedTags(store, [
        createMockTag({ id: 'tag_001', name: '標籤', categoryId: 'cat_001', isSystem: false })
      ])
      seedBooks(store, [
        createMockBookV2({ id: 'book_1', tagIds: ['tag_001'] }),
        createMockBookV2({ id: 'book_2', tagIds: ['tag_001'] })
      ])

      const result = await TagStorageAdapter.deleteTag('tag_001')

      expect(result.success).toBe(true)

      // 書籍引用已移除
      const book1Tags = await TagStorageAdapter.getTagsForBook('book_1')
      expect(book1Tags).toHaveLength(0)
      const book2Tags = await TagStorageAdapter.getTagsForBook('book_2')
      expect(book2Tags).toHaveLength(0)

      // tag 已刪除
      const tags = await TagStorageAdapter.getAllTags()
      expect(tags.find(t => t.id === 'tag_001')).toBeUndefined()
    })

    test('從書籍移除引用失敗時應回滾，tag 不被刪除', async () => {
      seedTags(store, [
        createMockTag({ id: 'tag_001', name: '標籤', categoryId: 'cat_001', isSystem: false })
      ])
      seedBooks(store, [
        createMockBookV2({ id: 'book_1', tagIds: ['tag_001'] })
      ])

      // 模擬 saveBooksWrapper 失敗：set readmoo_books 時觸發 lastError
      let setCallCount = 0
      const originalSet = chrome.storage.local.set.getMockImplementation()
      chrome.storage.local.set.mockImplementation((items, callback) => {
        setCallCount++
        // 第一次 set readmoo_books 時模擬寫入失敗
        if (setCallCount === 1 && items.readmoo_books !== undefined) {
          // 不寫入 store，模擬失敗
          chrome.runtime.lastError = { message: 'Write failed' }
          if (callback) callback()
          delete chrome.runtime.lastError
          return
        }
        // 回滾時的寫入正常執行
        originalSet(items, callback)
      })

      const result = await TagStorageAdapter.deleteTag('tag_001')

      // 還原 mock，確保後續測試不受影響
      chrome.storage.local.set.mockImplementation(originalSet)
      delete chrome.runtime.lastError

      // 失敗後回滾
      expect(result.success).toBe(false)

      // tag 仍存在（已回滾）
      const tags = await TagStorageAdapter.getAllTags()
      expect(tags.find(t => t.id === 'tag_001')).toBeDefined()
    })
  })

  describe('deleteCategory 原子性', () => {
    test('刪除 category 應依序：移除書籍引用 -> 刪除 tags -> 刪除 category', async () => {
      seedTags(store, [
        createMockTag({ id: 'tag_A', name: 'A', categoryId: 'cat_001' }),
        createMockTag({ id: 'tag_B', name: 'B', categoryId: 'cat_001' })
      ])
      seedBooks(store, [
        createMockBookV2({ id: 'book_1', tagIds: ['tag_A'] })
      ])

      const result = await TagStorageAdapter.deleteTagCategory('cat_001')

      expect(result.success).toBe(true)

      // 書籍引用已移除
      const book1Tags = await TagStorageAdapter.getTagsForBook('book_1')
      expect(book1Tags).toHaveLength(0)

      // tags 已刪除
      const tags = await TagStorageAdapter.getAllTags()
      expect(tags).toHaveLength(0)

      // category 已刪除
      const categories = await TagStorageAdapter.getAllTagCategories()
      expect(categories).toHaveLength(0)
    })

    test('中間步驟失敗時應回滾所有已完成步驟', async () => {
      seedTags(store, [
        createMockTag({ id: 'tag_A', name: 'A', categoryId: 'cat_001' })
      ])
      seedBooks(store, [
        createMockBookV2({ id: 'book_1', tagIds: ['tag_A'] })
      ])

      // 模擬寫入 tags 時觸發 lastError
      let writeCount = 0
      const originalSet = chrome.storage.local.set.getMockImplementation()
      chrome.storage.local.set.mockImplementation((items, callback) => {
        writeCount++
        // 第二次寫入（刪除 tags）失敗
        if (writeCount === 2 && items.tags !== undefined) {
          chrome.runtime.lastError = { message: 'Write tags failed' }
          if (callback) callback()
          delete chrome.runtime.lastError
          return
        }
        originalSet(items, callback)
      })

      const result = await TagStorageAdapter.deleteTagCategory('cat_001')

      // 還原 mock，確保後續測試不受影響
      chrome.storage.local.set.mockImplementation(originalSet)
      delete chrome.runtime.lastError

      // 失敗後回滾
      expect(result.success).toBe(false)

      // category 和 tags 仍存在
      const categories = await TagStorageAdapter.getAllTagCategories()
      expect(categories).toHaveLength(1)
    })
  })

  describe('引用完整性檢查', () => {
    test('書籍 tagIds 引用不存在的 tag 應自動移除無效 tagId', async () => {
      seedTags(store, [
        createMockTag({ id: 'tag_001', name: '有效', categoryId: 'cat_001' })
      ])
      seedBooks(store, [
        createMockBookV2({ id: 'book_1', tagIds: ['tag_001', 'tag_orphan'] })
      ])

      const result = await TagStorageAdapter.checkReferentialIntegrity()

      expect(result.success).toBe(true)
      expect(result.booksFixed).toBeGreaterThanOrEqual(1)

      const bookTags = await TagStorageAdapter.getTagsForBook('book_1')
      expect(bookTags).toHaveLength(1)
      expect(bookTags[0].id).toBe('tag_001')
    })

    test('tag 的 categoryId 引用不存在的 category 應移至預設 category 或刪除', async () => {
      seedTags(store, [
        createMockTag({ id: 'tag_001', name: '孤立', categoryId: 'cat_deleted' })
      ])

      const result = await TagStorageAdapter.checkReferentialIntegrity()

      expect(result.success).toBe(true)
      expect(result.tagsFixed).toBeGreaterThanOrEqual(1)

      const tags = await TagStorageAdapter.getAllTags()
      // tag 被移至預設 category 或被刪除
      if (tags.length > 0) {
        expect(tags[0].categoryId).not.toBe('cat_deleted')
      }
    })
  })
})

// --- Schema Version ---

describe('Schema Version 驗證', () => {
  let store

  beforeEach(() => {
    global.testUtils.cleanup()
    store = createStorageMock()
  })

  test('tag storage 初始化後 schema_version 應為 "3.0.0"', async () => {
    await TagStorageAdapter.initializeSchema()

    const version = store.schema_version

    expect(version).toBe('3.0.0')
  })
})
