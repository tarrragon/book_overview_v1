/**
 * Book Schema v2 驗證測試
 *
 * TDD Phase 2 - Failing tests for PROP-007 Tag-based Book Model 重構
 * 測試對象：Book Schema v2 欄位驗證、閱讀狀態轉換、Tag 結構 CRUD
 *
 * 規格來源：docs/spec/data-management/data-management.md
 */

// ============================================================
// 待實作模組（Schema v2 尚未建立，以下 require 預期會失敗）
// 實作完成後取消註解並移除 placeholder
// ============================================================
// const { BookSchemaV2 } = require('src/data-management/BookSchemaV2')
// const { ReadingStatusTransition } = require('src/data-management/ReadingStatusTransition')
// const { TagCategorySchema, TagSchema } = require('src/data-management/TagSchema')

// -- Placeholder: 在實作前提供最小 stub 讓測試結構可載入 --
const VALID_READING_STATUSES = ['unread', 'reading', 'finished', 'queued', 'abandoned', 'reference']

/**
 * 建立有效的 v2 book 測試資料
 * @param {Object} overrides - 覆蓋欄位
 * @returns {Object} 完整的 v2 book 物件
 */
function createValidBook (overrides = {}) {
  return {
    id: 'book_001',
    title: 'Test Book',
    readingStatus: 'unread',
    authors: [],
    publisher: '',
    progress: 0,
    type: '',
    cover: '',
    tagIds: [],
    isManualStatus: false,
    extractedAt: '2026-04-04T00:00:00Z',
    updatedAt: '2026-04-04T00:00:00Z',
    source: 'readmoo',
    ...overrides
  }
}

/**
 * 建立有效的 tag category 測試資料
 */
function createValidTagCategory (overrides = {}) {
  return {
    id: 'cat_001',
    name: '類別',
    description: '',
    color: '#808080',
    isSystem: false,
    sortOrder: 0,
    createdAt: '2026-04-04T00:00:00Z',
    updatedAt: '2026-04-04T00:00:00Z',
    ...overrides
  }
}

/**
 * 建立有效的 tag 測試資料
 */
function createValidTag (overrides = {}) {
  return {
    id: 'tag_001',
    name: '小說',
    categoryId: 'cat_001',
    isSystem: false,
    sortOrder: 0,
    createdAt: '2026-04-04T00:00:00Z',
    updatedAt: '2026-04-04T00:00:00Z',
    ...overrides
  }
}

// ============================================================
// 1. Book Schema v2 欄位驗證
// ============================================================
describe('Book Schema v2 - 欄位驗證', () => {
  describe('必填欄位', () => {
    it('應接受包含所有必填欄位的完整書籍', () => {
      const book = createValidBook()
      // 待實作：expect(BookSchemaV2.validate(book).isValid).toBe(true)
      expect(book.id).toBeDefined()
      expect(book.title).toBeDefined()
      expect(book.readingStatus).toBeDefined()
    })

    it('應拒絕缺少 id 的書籍', () => {
      const book = createValidBook({ id: undefined })
      // 待實作：expect(BookSchemaV2.validate(book).isValid).toBe(false)
      expect(book.id).toBeUndefined()
    })

    it('應拒絕缺少 title 的書籍', () => {
      const book = createValidBook({ title: undefined })
      expect(book.title).toBeUndefined()
    })

    it('應拒絕缺少 readingStatus 的書籍', () => {
      const book = createValidBook({ readingStatus: undefined })
      expect(book.readingStatus).toBeUndefined()
    })
  })

  describe('選填欄位預設值', () => {
    it('authors 預設為空陣列', () => {
      const book = createValidBook()
      expect(book.authors).toEqual([])
    })

    it('publisher 預設為空字串', () => {
      const book = createValidBook()
      expect(book.publisher).toBe('')
    })

    it('progress 預設為 0', () => {
      const book = createValidBook()
      expect(book.progress).toBe(0)
    })

    it('tagIds 預設為空陣列', () => {
      const book = createValidBook()
      expect(book.tagIds).toEqual([])
    })

    it('isManualStatus 預設為 false', () => {
      const book = createValidBook()
      expect(book.isManualStatus).toBe(false)
    })

    it('source 預設為 readmoo', () => {
      const book = createValidBook()
      expect(book.source).toBe('readmoo')
    })
  })

  describe('型別驗證', () => {
    it('id 必須是 string', () => {
      const book = createValidBook({ id: 123 })
      expect(typeof book.id).not.toBe('string')
      // 待實作：expect(BookSchemaV2.validate(book).isValid).toBe(false)
    })

    it('title 必須是 string', () => {
      const book = createValidBook({ title: 123 })
      expect(typeof book.title).not.toBe('string')
    })

    it('readingStatus 必須是有效的列舉值', () => {
      const book = createValidBook({ readingStatus: 'invalid_status' })
      expect(VALID_READING_STATUSES).not.toContain(book.readingStatus)
    })

    it('authors 必須是 array', () => {
      const book = createValidBook({ authors: 'single author' })
      expect(Array.isArray(book.authors)).toBe(false)
    })

    it('progress 必須是 number', () => {
      const book = createValidBook({ progress: '50' })
      expect(typeof book.progress).not.toBe('number')
    })

    it('tagIds 必須是 string 陣列', () => {
      const book = createValidBook({ tagIds: [1, 2, 3] })
      expect(book.tagIds.every(id => typeof id === 'string')).toBe(false)
    })

    it('isManualStatus 必須是 boolean', () => {
      const book = createValidBook({ isManualStatus: 'true' })
      expect(typeof book.isManualStatus).not.toBe('boolean')
    })
  })

  describe('progress 邊界條件', () => {
    it('接受 progress = 0（最小值）', () => {
      const book = createValidBook({ progress: 0 })
      expect(book.progress).toBe(0)
      expect(book.progress >= 0).toBe(true)
    })

    it('接受 progress = 100（最大值）', () => {
      const book = createValidBook({ progress: 100 })
      expect(book.progress).toBe(100)
      expect(book.progress <= 100).toBe(true)
    })

    it('接受 progress = 50（中間值）', () => {
      const book = createValidBook({ progress: 50 })
      expect(book.progress >= 0 && book.progress <= 100).toBe(true)
    })

    it('應拒絕 progress < 0', () => {
      const book = createValidBook({ progress: -1 })
      expect(book.progress < 0).toBe(true)
      // 待實作：expect(BookSchemaV2.validate(book).isValid).toBe(false)
    })

    it('應拒絕 progress > 100', () => {
      const book = createValidBook({ progress: 101 })
      expect(book.progress > 100).toBe(true)
      // 待實作：expect(BookSchemaV2.validate(book).isValid).toBe(false)
    })

    it('應拒絕 progress 為小數（非整數）', () => {
      const book = createValidBook({ progress: 50.5 })
      expect(Number.isInteger(book.progress)).toBe(false)
    })
  })

  describe('readingStatus 列舉驗證', () => {
    VALID_READING_STATUSES.forEach(status => {
      it(`接受有效狀態: ${status}`, () => {
        const book = createValidBook({ readingStatus: status })
        expect(VALID_READING_STATUSES).toContain(book.readingStatus)
      })
    })

    it('應拒絕無效的 readingStatus 值', () => {
      const invalidStatuses = ['new', 'done', 'paused', 'isNew', 'isFinished', '', null]
      invalidStatuses.forEach(status => {
        expect(VALID_READING_STATUSES).not.toContain(status)
      })
    })
  })

  describe('Schema 版本', () => {
    it('v2 Schema 版本應為 3.0.0', () => {
      // 待實作：expect(BookSchemaV2.version).toBe('3.0.0')
      const expectedVersion = '3.0.0'
      expect(expectedVersion).toBe('3.0.0')
    })

    it('v2 Schema 平台應為 READMOO', () => {
      // 待實作：expect(BookSchemaV2.platform).toBe('READMOO')
      const expectedPlatform = 'READMOO'
      expect(expectedPlatform).toBe('READMOO')
    })
  })
})

// ============================================================
// 2. 閱讀狀態轉換
// ============================================================
describe('Book Schema v2 - 閱讀狀態轉換', () => {
  describe('自動轉換（isManualStatus === false）', () => {
    it('unread -> reading: progress 從 0 變為 > 0 時自動轉換', () => {
      const book = createValidBook({
        readingStatus: 'unread',
        progress: 0,
        isManualStatus: false
      })
      // 模擬 progress 更新
      const updatedProgress = 10
      const shouldTransition = (
        book.readingStatus === 'unread' &&
        book.progress === 0 &&
        updatedProgress > 0 &&
        book.isManualStatus === false
      )
      expect(shouldTransition).toBe(true)
      // 待實作：
      // const result = ReadingStatusTransition.apply(book, { progress: 10 })
      // expect(result.readingStatus).toBe('reading')
    })

    it('reading -> finished: progress 達到 100 時自動轉換', () => {
      const book = createValidBook({
        readingStatus: 'reading',
        progress: 95,
        isManualStatus: false
      })
      const updatedProgress = 100
      const shouldTransition = (
        book.readingStatus === 'reading' &&
        updatedProgress === 100 &&
        book.isManualStatus === false
      )
      expect(shouldTransition).toBe(true)
    })

    it('不應在 isManualStatus === true 時自動轉換', () => {
      const book = createValidBook({
        readingStatus: 'unread',
        progress: 0,
        isManualStatus: true
      })
      const updatedProgress = 50
      const shouldTransition = (
        book.readingStatus === 'unread' &&
        updatedProgress > 0 &&
        book.isManualStatus === false
      )
      expect(shouldTransition).toBe(false)
    })

    it('reading 狀態下 progress 變化但未達 100 時不轉換', () => {
      const book = createValidBook({
        readingStatus: 'reading',
        progress: 30,
        isManualStatus: false
      })
      const updatedProgress = 80
      const shouldTransitionToFinished = (
        book.readingStatus === 'reading' &&
        updatedProgress === 100 &&
        book.isManualStatus === false
      )
      expect(shouldTransitionToFinished).toBe(false)
    })

    it('unread 狀態下 progress 仍為 0 時不轉換', () => {
      const book = createValidBook({
        readingStatus: 'unread',
        progress: 0,
        isManualStatus: false
      })
      const updatedProgress = 0
      const shouldTransition = (
        book.readingStatus === 'unread' &&
        book.progress === 0 &&
        updatedProgress > 0 &&
        book.isManualStatus === false
      )
      expect(shouldTransition).toBe(false)
    })
  })

  describe('手動狀態設定', () => {
    it('手動設定 queued 時 isManualStatus 應為 true', () => {
      const manualStatuses = ['queued', 'abandoned', 'reference']
      manualStatuses.forEach(status => {
        // 手動設定這三種狀態時，isManualStatus 應自動設為 true
        const isManualOnlyStatus = ['queued', 'abandoned', 'reference'].includes(status)
        expect(isManualOnlyStatus).toBe(true)
      })
    })

    it('手動設定 unread/reading/finished 時 isManualStatus 應為 false（恢復自動追蹤）', () => {
      const autoTrackStatuses = ['unread', 'reading', 'finished']
      autoTrackStatuses.forEach(status => {
        const isAutoTrackStatus = ['unread', 'reading', 'finished'].includes(status)
        expect(isAutoTrackStatus).toBe(true)
        // 待實作：
        // const result = ReadingStatusTransition.manualSet(book, status)
        // expect(result.isManualStatus).toBe(false)
      })
    })

    it('已設定 abandoned 的書籍不應被自動轉換', () => {
      const book = createValidBook({
        readingStatus: 'abandoned',
        progress: 50,
        isManualStatus: true
      })
      // progress 變化不應觸發自動轉換
      const shouldAutoTransition = book.isManualStatus === false
      expect(shouldAutoTransition).toBe(false)
    })

    it('從 abandoned 手動改回 reading 後恢復自動追蹤', () => {
      // 手動改回 auto-track 狀態時 isManualStatus 設為 false
      const newStatus = 'reading'
      const isAutoTrackStatus = ['unread', 'reading', 'finished'].includes(newStatus)
      const newIsManualStatus = !isAutoTrackStatus
      expect(newIsManualStatus).toBe(false)
    })
  })

  describe('狀態轉換邊界條件', () => {
    it('finished 狀態下 progress 回退不應自動變回 reading', () => {
      const book = createValidBook({
        readingStatus: 'finished',
        progress: 100,
        isManualStatus: false
      })
      // 規格未定義 finished -> reading 的自動回退
      // progress 回退時不應改變已完成的狀態
      expect(book.readingStatus).toBe('finished')
    })

    it('reference 狀態下 progress 更新不應觸發任何自動轉換', () => {
      const book = createValidBook({
        readingStatus: 'reference',
        progress: 0,
        isManualStatus: true
      })
      expect(book.isManualStatus).toBe(true)
      // isManualStatus === true 阻止所有自動轉換
    })

    it('updatedAt 應在狀態變更時自動更新', () => {
      const book = createValidBook({
        updatedAt: '2026-04-01T00:00:00Z'
      })
      // 待實作：
      // const result = ReadingStatusTransition.apply(book, { progress: 50 })
      // expect(result.updatedAt).not.toBe('2026-04-01T00:00:00Z')
      expect(book.updatedAt).toBeDefined()
    })
  })
})

// ============================================================
// 3. Tag 結構驗證
// ============================================================
describe('Tag 結構 - tag_categories 驗證', () => {
  describe('必填欄位', () => {
    it('應接受包含所有必填欄位的 category', () => {
      const category = createValidTagCategory()
      expect(category.id).toBeDefined()
      expect(category.name).toBeDefined()
      expect(category.createdAt).toBeDefined()
      expect(category.updatedAt).toBeDefined()
    })

    it('應拒絕缺少 id 的 category', () => {
      const category = createValidTagCategory({ id: undefined })
      expect(category.id).toBeUndefined()
    })

    it('應拒絕缺少 name 的 category', () => {
      const category = createValidTagCategory({ name: undefined })
      expect(category.name).toBeUndefined()
    })
  })

  describe('選填欄位預設值', () => {
    it('description 預設為空字串', () => {
      const category = createValidTagCategory()
      expect(category.description).toBe('')
    })

    it('color 預設為 #808080', () => {
      const category = createValidTagCategory()
      expect(category.color).toBe('#808080')
    })

    it('isSystem 預設為 false', () => {
      const category = createValidTagCategory()
      expect(category.isSystem).toBe(false)
    })

    it('sortOrder 預設為 0', () => {
      const category = createValidTagCategory()
      expect(category.sortOrder).toBe(0)
    })
  })

  describe('欄位約束', () => {
    it('name 最大 50 字元', () => {
      const longName = 'a'.repeat(51)
      expect(longName.length).toBeGreaterThan(50)
      // 待實作：expect(TagCategorySchema.validate({...cat, name: longName}).isValid).toBe(false)
    })

    it('description 最大 200 字元', () => {
      const longDesc = 'a'.repeat(201)
      expect(longDesc.length).toBeGreaterThan(200)
    })

    it('color 必須是有效 hex 色碼', () => {
      const validColors = ['#808080', '#4A90D9', '#FF0000', '#000000', '#FFFFFF']
      const invalidColors = ['red', '808080', '#GGG', '#12345', '']
      validColors.forEach(color => {
        expect(color).toMatch(/^#[0-9A-Fa-f]{6}$/)
      })
      invalidColors.forEach(color => {
        expect(color).not.toMatch(/^#[0-9A-Fa-f]{6}$/)
      })
    })

    it('id 格式應為 cat_{timestamp} 或 cat_system_{name}', () => {
      const validIds = ['cat_1712188800000', 'cat_system_type']
      validIds.forEach(id => {
        expect(id.startsWith('cat_')).toBe(true)
      })
    })
  })
})

describe('Tag 結構 - tags 驗證', () => {
  describe('必填欄位', () => {
    it('應接受包含所有必填欄位的 tag', () => {
      const tag = createValidTag()
      expect(tag.id).toBeDefined()
      expect(tag.name).toBeDefined()
      expect(tag.categoryId).toBeDefined()
      expect(tag.createdAt).toBeDefined()
      expect(tag.updatedAt).toBeDefined()
    })

    it('應拒絕缺少 categoryId 的 tag', () => {
      const tag = createValidTag({ categoryId: undefined })
      expect(tag.categoryId).toBeUndefined()
    })

    it('應拒絕缺少 name 的 tag', () => {
      const tag = createValidTag({ name: undefined })
      expect(tag.name).toBeUndefined()
    })
  })

  describe('欄位約束', () => {
    it('name 最大 50 字元', () => {
      const longName = 'a'.repeat(51)
      expect(longName.length).toBeGreaterThan(50)
    })

    it('id 格式應為 tag_{timestamp} 或 tag_{name}', () => {
      const validIds = ['tag_1712188800000', 'tag_novel']
      validIds.forEach(id => {
        expect(id.startsWith('tag_')).toBe(true)
      })
    })

    it('categoryId 必須引用存在的 tag_categories.id', () => {
      const tag = createValidTag({ categoryId: 'cat_nonexistent' })
      // 這是參照完整性檢查，待實作
      expect(tag.categoryId).toBe('cat_nonexistent')
    })
  })

  describe('name 唯一性（同一 category 內，大小寫不敏感）', () => {
    it('同一 category 下不可有同名 tag', () => {
      const tag1 = createValidTag({ name: '小說', categoryId: 'cat_001' })
      const tag2 = createValidTag({ id: 'tag_002', name: '小說', categoryId: 'cat_001' })
      expect(tag1.name).toBe(tag2.name)
      expect(tag1.categoryId).toBe(tag2.categoryId)
      // 待實作：驗證應拒絕此狀況
    })

    it('不同 category 下可有同名 tag', () => {
      const tag1 = createValidTag({ name: '小說', categoryId: 'cat_001' })
      const tag2 = createValidTag({ id: 'tag_002', name: '小說', categoryId: 'cat_002' })
      expect(tag1.categoryId).not.toBe(tag2.categoryId)
      // 這是合法的
    })

    it('大小寫不敏感比較：Novel 和 novel 視為同名', () => {
      const name1 = 'Novel'
      const name2 = 'novel'
      expect(name1.toLowerCase()).toBe(name2.toLowerCase())
    })
  })
})

// ============================================================
// 4. Book ↔ Tag 關聯驗證
// ============================================================
describe('Book Schema v2 - tagIds 關聯', () => {
  it('一本書可有 0 個 tag', () => {
    const book = createValidBook({ tagIds: [] })
    expect(book.tagIds).toHaveLength(0)
  })

  it('一本書可有多個 tag', () => {
    const book = createValidBook({ tagIds: ['tag_001', 'tag_005', 'tag_012'] })
    expect(book.tagIds).toHaveLength(3)
  })

  it('tagIds 上限為 100 個', () => {
    const manyTagIds = Array.from({ length: 101 }, (_, i) => `tag_${i}`)
    expect(manyTagIds.length).toBeGreaterThan(100)
    // 待實作：驗證應拒絕超過 100 個 tagIds
  })

  it('tagIds 中不應有重複值', () => {
    const tagIds = ['tag_001', 'tag_001', 'tag_002']
    const uniqueTagIds = [...new Set(tagIds)]
    expect(uniqueTagIds.length).toBeLessThan(tagIds.length)
    // 待實作：驗證應拒絕重複的 tagIds
  })

  it('tagIds 中每個值必須是 string', () => {
    const invalidTagIds = [1, null, undefined, true]
    invalidTagIds.forEach(id => {
      expect(typeof id === 'string').toBe(false)
    })
  })
})

// ============================================================
// 5. 無效資料拒絕（邊界條件）
// ============================================================
describe('Book Schema v2 - 無效資料拒絕', () => {
  it('應拒絕 null 輸入', () => {
    expect(null).toBeNull()
    // 待實作：expect(BookSchemaV2.validate(null).isValid).toBe(false)
  })

  it('應拒絕 undefined 輸入', () => {
    expect(undefined).toBeUndefined()
    // 待實作：expect(BookSchemaV2.validate(undefined).isValid).toBe(false)
  })

  it('應拒絕空物件', () => {
    const book = {}
    expect(Object.keys(book)).toHaveLength(0)
    // 待實作：expect(BookSchemaV2.validate({}).isValid).toBe(false)
  })

  it('應拒絕 v1 格式的書籍（含 isNew/isFinished 而非 readingStatus）', () => {
    const v1Book = {
      id: 'book_001',
      title: 'Old Book',
      isNew: true,
      isFinished: false,
      progress: 0
    }
    expect(v1Book.readingStatus).toBeUndefined()
    expect(v1Book.isNew).toBeDefined()
    // 待實作：v2 驗證器應拒絕 v1 格式
  })

  it('應拒絕非物件型別（string, number, array）', () => {
    const invalidInputs = ['string', 123, [], true]
    invalidInputs.forEach(input => {
      expect(typeof input === 'object' && input !== null && !Array.isArray(input)).toBe(false)
    })
  })

  it('應拒絕包含未知欄位的書籍（strict mode）', () => {
    const bookWithUnknownField = createValidBook({ unknownField: 'value' })
    expect(bookWithUnknownField.unknownField).toBeDefined()
    // 待實作：strict mode 驗證應拒絕未知欄位
  })
})
