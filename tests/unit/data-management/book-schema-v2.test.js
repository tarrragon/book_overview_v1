/**
 * Book Schema v2 驗證測試
 *
 * 涵蓋範圍：
 * - Book Schema v2 欄位定義（必填/選填/型別/預設值）
 * - ReadingStatus 列舉（6 種狀態）
 * - 自動狀態轉換（progress → status）
 * - 手動狀態設定（isManualStatus 機制）
 * - v1 → v2 狀態對映
 * - TagCategory Schema 驗證
 * - Tag Schema 驗證
 * - tagIds 驗證
 *
 * TDD Phase 2（Red）：基於 SPEC-004 Book Schema v2 規格撰寫
 * 對應 Ticket: 0.17.0-W2-001
 */

const {
  READING_STATUS,
  READING_STATUS_VALUES,
  SCHEMA_VERSION,
  BOOK_SCHEMA_V2,
  isManualOnlyStatus,
  isAutoTrackableStatus,
  validateField,
  validateBook,
  applyDefaults,
  computeAutoStatusTransition,
  computeManualStatusChange,
  mapV1StatusToV2
} = require('src/data-management/BookSchemaV2')

const {
  TAG_CATEGORY_SCHEMA,
  TAG_SCHEMA,
  TAG_CATEGORY_NAME_MAX_LENGTH,
  TAG_CATEGORY_DESCRIPTION_MAX_LENGTH,
  TAG_NAME_MAX_LENGTH,
  MAX_TAGS_PER_BOOK,
  DEFAULT_COLOR,
  validateTagCategory,
  validateTag,
  validateTagIds
} = require('src/data-management/TagSchema')

// === 測試輔助 ===

function createValidBook (overrides = {}) {
  return {
    id: 'book_001',
    title: '測試書籍',
    readingStatus: 'unread',
    authors: ['作者A'],
    publisher: '出版社',
    progress: 0,
    type: 'epub',
    cover: 'https://example.com/cover.jpg',
    tagIds: [],
    isManualStatus: false,
    extractedAt: '2026-04-03T00:00:00Z',
    updatedAt: '2026-04-03T00:00:00Z',
    source: 'readmoo',
    ...overrides
  }
}

function createValidCategory (overrides = {}) {
  return {
    id: 'cat_001',
    name: '類別',
    description: '書籍主題分類',
    color: '#4A90D9',
    isSystem: true,
    sortOrder: 0,
    createdAt: '2026-04-03T00:00:00Z',
    updatedAt: '2026-04-03T00:00:00Z',
    ...overrides
  }
}

function createValidTag (overrides = {}) {
  return {
    id: 'tag_001',
    name: '小說',
    categoryId: 'cat_001',
    isSystem: true,
    sortOrder: 0,
    createdAt: '2026-04-03T00:00:00Z',
    updatedAt: '2026-04-03T00:00:00Z',
    ...overrides
  }
}

// ============================================================
// 1. Schema 定義
// ============================================================

describe('Book Schema v2 定義', () => {
  test('Schema 版本為 3.0.0', () => {
    expect(SCHEMA_VERSION).toBe('3.0.0')
  })

  test('Schema 平台為 READMOO', () => {
    expect(BOOK_SCHEMA_V2.platform).toBe('READMOO')
  })

  test('Schema 包含所有必填欄位', () => {
    const requiredFields = Object.entries(BOOK_SCHEMA_V2.fields)
      .filter(([, def]) => def.required)
      .map(([name]) => name)
    expect(requiredFields).toEqual(['id', 'title', 'readingStatus'])
  })

  test('Schema 包含所有選填欄位', () => {
    const optionalFields = Object.entries(BOOK_SCHEMA_V2.fields)
      .filter(([, def]) => !def.required && !def.auto)
      .map(([name]) => name)
    expect(optionalFields).toContain('authors')
    expect(optionalFields).toContain('publisher')
    expect(optionalFields).toContain('progress')
    expect(optionalFields).toContain('tagIds')
    expect(optionalFields).toContain('isManualStatus')
  })

  test('Schema 包含自動欄位', () => {
    const autoFields = Object.entries(BOOK_SCHEMA_V2.fields)
      .filter(([, def]) => def.auto)
      .map(([name]) => name)
    expect(autoFields).toContain('extractedAt')
    expect(autoFields).toContain('updatedAt')
    expect(autoFields).toContain('source')
  })

  test('progress 欄位範圍為 0-100', () => {
    const progressDef = BOOK_SCHEMA_V2.fields.progress
    expect(progressDef.min).toBe(0)
    expect(progressDef.max).toBe(100)
  })

  test('readingStatus 欄位有 enum 限制', () => {
    const statusDef = BOOK_SCHEMA_V2.fields.readingStatus
    expect(statusDef.enum).toEqual(READING_STATUS_VALUES)
  })

  test('tagIds 欄位定義 items 為 string', () => {
    expect(BOOK_SCHEMA_V2.fields.tagIds.items).toBe('string')
  })
})

// ============================================================
// 2. ReadingStatus 列舉
// ============================================================

describe('ReadingStatus 列舉', () => {
  test('包含 6 種狀態', () => {
    expect(READING_STATUS_VALUES).toHaveLength(6)
  })

  test('包含 unread 狀態', () => {
    expect(READING_STATUS.UNREAD).toBe('unread')
  })

  test('包含 reading 狀態', () => {
    expect(READING_STATUS.READING).toBe('reading')
  })

  test('包含 finished 狀態', () => {
    expect(READING_STATUS.FINISHED).toBe('finished')
  })

  test('包含 queued 狀態', () => {
    expect(READING_STATUS.QUEUED).toBe('queued')
  })

  test('包含 abandoned 狀態', () => {
    expect(READING_STATUS.ABANDONED).toBe('abandoned')
  })

  test('包含 reference 狀態', () => {
    expect(READING_STATUS.REFERENCE).toBe('reference')
  })

  test('READING_STATUS 物件已凍結', () => {
    expect(Object.isFrozen(READING_STATUS)).toBe(true)
  })

  test('isManualOnlyStatus 辨識手動專用狀態', () => {
    expect(isManualOnlyStatus('queued')).toBe(true)
    expect(isManualOnlyStatus('abandoned')).toBe(true)
    expect(isManualOnlyStatus('reference')).toBe(true)
    expect(isManualOnlyStatus('unread')).toBe(false)
    expect(isManualOnlyStatus('reading')).toBe(false)
    expect(isManualOnlyStatus('finished')).toBe(false)
  })

  test('isAutoTrackableStatus 辨識自動可追蹤狀態', () => {
    expect(isAutoTrackableStatus('unread')).toBe(true)
    expect(isAutoTrackableStatus('reading')).toBe(true)
    expect(isAutoTrackableStatus('finished')).toBe(true)
    expect(isAutoTrackableStatus('queued')).toBe(false)
    expect(isAutoTrackableStatus('abandoned')).toBe(false)
    expect(isAutoTrackableStatus('reference')).toBe(false)
  })
})

// ============================================================
// 3. Book 欄位驗證
// ============================================================

describe('Book 欄位驗證', () => {
  describe('必填欄位', () => {
    test('缺少 id 時驗證失敗', () => {
      const book = createValidBook({ id: undefined })
      const result = validateBook(book)
      expect(result.valid).toBe(false)
      expect(result.errors.some((e) => e.includes('id'))).toBe(true)
    })

    test('缺少 title 時驗證失敗', () => {
      const book = createValidBook({ title: undefined })
      const result = validateBook(book)
      expect(result.valid).toBe(false)
      expect(result.errors.some((e) => e.includes('title'))).toBe(true)
    })

    test('缺少 readingStatus 時驗證失敗', () => {
      const book = createValidBook({ readingStatus: undefined })
      const result = validateBook(book)
      expect(result.valid).toBe(false)
      expect(result.errors.some((e) => e.includes('readingStatus'))).toBe(true)
    })

    test('空字串 id 視為缺失', () => {
      const book = createValidBook({ id: '' })
      const result = validateBook(book)
      expect(result.valid).toBe(false)
    })

    test('空字串 title 視為缺失', () => {
      const book = createValidBook({ title: '' })
      const result = validateBook(book)
      expect(result.valid).toBe(false)
    })
  })

  describe('型別檢查', () => {
    test('id 為數字時驗證失敗', () => {
      const book = createValidBook({ id: 123 })
      const result = validateBook(book)
      expect(result.valid).toBe(false)
    })

    test('title 為數字時驗證失敗', () => {
      const book = createValidBook({ title: 456 })
      const result = validateBook(book)
      expect(result.valid).toBe(false)
    })

    test('progress 為字串時驗證失敗', () => {
      const book = createValidBook({ progress: '50' })
      const result = validateBook(book)
      expect(result.valid).toBe(false)
    })

    test('authors 為字串時驗證失敗', () => {
      const book = createValidBook({ authors: '作者' })
      const result = validateBook(book)
      expect(result.valid).toBe(false)
    })

    test('isManualStatus 為字串時驗證失敗', () => {
      const book = createValidBook({ isManualStatus: 'true' })
      const result = validateBook(book)
      expect(result.valid).toBe(false)
    })

    test('tagIds 包含非 string 元素時驗證失敗', () => {
      const book = createValidBook({ tagIds: ['tag_001', 123] })
      const result = validateBook(book)
      expect(result.valid).toBe(false)
    })
  })

  describe('enum 驗證', () => {
    test('readingStatus 為無效值時驗證失敗', () => {
      const book = createValidBook({ readingStatus: 'invalid_status' })
      const result = validateBook(book)
      expect(result.valid).toBe(false)
    })

    test.each(READING_STATUS_VALUES)('readingStatus=%s 時驗證通過', (status) => {
      const book = createValidBook({ readingStatus: status })
      const result = validateBook(book)
      expect(result.valid).toBe(true)
    })
  })

  describe('數值範圍', () => {
    test('progress < 0 時驗證失敗', () => {
      const book = createValidBook({ progress: -1 })
      const result = validateBook(book)
      expect(result.valid).toBe(false)
    })

    test('progress > 100 時驗證失敗', () => {
      const book = createValidBook({ progress: 101 })
      const result = validateBook(book)
      expect(result.valid).toBe(false)
    })

    test('progress = 0 時驗證通過', () => {
      const book = createValidBook({ progress: 0 })
      const result = validateBook(book)
      expect(result.valid).toBe(true)
    })

    test('progress = 100 時驗證通過', () => {
      const book = createValidBook({ progress: 100 })
      const result = validateBook(book)
      expect(result.valid).toBe(true)
    })
  })

  describe('完整 Book 驗證', () => {
    test('有效的完整 Book 通過驗證', () => {
      const book = createValidBook()
      const result = validateBook(book)
      expect(result.valid).toBe(true)
      expect(result.errors).toHaveLength(0)
    })

    test('null 輸入驗證失敗', () => {
      const result = validateBook(null)
      expect(result.valid).toBe(false)
    })

    test('非物件輸入驗證失敗', () => {
      const result = validateBook('not an object')
      expect(result.valid).toBe(false)
    })

    test('多個欄位錯誤時回傳所有錯誤', () => {
      const book = { progress: 'not a number' }
      const result = validateBook(book)
      expect(result.valid).toBe(false)
      expect(result.errors.length).toBeGreaterThan(1)
    })
  })
})

// ============================================================
// 4. 預設值
// ============================================================

describe('預設值填入', () => {
  test('僅提供必填欄位時填入所有預設值', () => {
    const book = { id: 'b1', title: '書', readingStatus: 'unread' }
    const result = applyDefaults(book)
    expect(result.authors).toEqual([])
    expect(result.publisher).toBe('')
    expect(result.progress).toBe(0)
    expect(result.tagIds).toEqual([])
    expect(result.isManualStatus).toBe(false)
    expect(result.source).toBe('readmoo')
  })

  test('已有值的欄位不被覆蓋', () => {
    const book = { id: 'b1', title: '書', readingStatus: 'reading', progress: 50, authors: ['作者'] }
    const result = applyDefaults(book)
    expect(result.progress).toBe(50)
    expect(result.authors).toEqual(['作者'])
  })

  test('陣列預設值為獨立副本（不共享引用）', () => {
    const book1 = applyDefaults({ id: 'b1', title: '書1', readingStatus: 'unread' })
    const book2 = applyDefaults({ id: 'b2', title: '書2', readingStatus: 'unread' })
    book1.authors.push('作者')
    expect(book2.authors).toHaveLength(0)
  })

  test('null 輸入回傳 null', () => {
    expect(applyDefaults(null)).toBeNull()
  })
})

// ============================================================
// 5. 自動狀態轉換
// ============================================================

describe('自動狀態轉換', () => {
  test('unread + progress > 0 → reading', () => {
    const book = { readingStatus: 'unread', progress: 0, isManualStatus: false }
    const result = computeAutoStatusTransition(book, 10)
    expect(result).toEqual({ readingStatus: 'reading', isManualStatus: false })
  })

  test('reading + progress = 100 → finished', () => {
    const book = { readingStatus: 'reading', progress: 50, isManualStatus: false }
    const result = computeAutoStatusTransition(book, 100)
    expect(result).toEqual({ readingStatus: 'finished', isManualStatus: false })
  })

  test('isManualStatus=true 時不觸發自動轉換', () => {
    const book = { readingStatus: 'queued', progress: 0, isManualStatus: true }
    const result = computeAutoStatusTransition(book, 50)
    expect(result).toBeNull()
  })

  test('unread + progress 仍為 0 → 不轉換', () => {
    const book = { readingStatus: 'unread', progress: 0, isManualStatus: false }
    const result = computeAutoStatusTransition(book, 0)
    expect(result).toBeNull()
  })

  test('reading + progress < 100 → 不轉換', () => {
    const book = { readingStatus: 'reading', progress: 30, isManualStatus: false }
    const result = computeAutoStatusTransition(book, 60)
    expect(result).toBeNull()
  })

  test('finished 狀態不再自動轉換', () => {
    const book = { readingStatus: 'finished', progress: 100, isManualStatus: false }
    const result = computeAutoStatusTransition(book, 50)
    expect(result).toBeNull()
  })

  test('abandoned + isManualStatus=true 不觸發自動轉換', () => {
    const book = { readingStatus: 'abandoned', progress: 30, isManualStatus: true }
    const result = computeAutoStatusTransition(book, 100)
    expect(result).toBeNull()
  })
})

// ============================================================
// 6. 手動狀態設定
// ============================================================

describe('手動狀態設定', () => {
  test('設定 queued → isManualStatus=true', () => {
    const result = computeManualStatusChange('queued')
    expect(result).toEqual({ readingStatus: 'queued', isManualStatus: true })
  })

  test('設定 abandoned → isManualStatus=true', () => {
    const result = computeManualStatusChange('abandoned')
    expect(result).toEqual({ readingStatus: 'abandoned', isManualStatus: true })
  })

  test('設定 reference → isManualStatus=true', () => {
    const result = computeManualStatusChange('reference')
    expect(result).toEqual({ readingStatus: 'reference', isManualStatus: true })
  })

  test('手動設定 unread → isManualStatus=false（恢復自動追蹤）', () => {
    const result = computeManualStatusChange('unread')
    expect(result).toEqual({ readingStatus: 'unread', isManualStatus: false })
  })

  test('手動設定 reading → isManualStatus=false', () => {
    const result = computeManualStatusChange('reading')
    expect(result).toEqual({ readingStatus: 'reading', isManualStatus: false })
  })

  test('手動設定 finished → isManualStatus=false', () => {
    const result = computeManualStatusChange('finished')
    expect(result).toEqual({ readingStatus: 'finished', isManualStatus: false })
  })

  test('無效狀態回傳 null', () => {
    const result = computeManualStatusChange('invalid')
    expect(result).toBeNull()
  })
})

// ============================================================
// 7. v1 → v2 狀態對映
// ============================================================

describe('v1 → v2 狀態對映', () => {
  test('isNew=true, isFinished=false → unread', () => {
    expect(mapV1StatusToV2({ isNew: true, isFinished: false })).toBe('unread')
  })

  test('isNew=false, isFinished=false, progress=0 → unread', () => {
    expect(mapV1StatusToV2({ isNew: false, isFinished: false, progress: 0 })).toBe('unread')
  })

  test('isNew=false, isFinished=false, progress>0 → reading', () => {
    expect(mapV1StatusToV2({ isNew: false, isFinished: false, progress: 50 })).toBe('reading')
  })

  test('isFinished=true → finished', () => {
    expect(mapV1StatusToV2({ isFinished: true })).toBe('finished')
  })

  test('isNew=true, isFinished=true（異常組合）→ finished', () => {
    expect(mapV1StatusToV2({ isNew: true, isFinished: true })).toBe('finished')
  })

  test('兩者皆 undefined → unread', () => {
    expect(mapV1StatusToV2({})).toBe('unread')
  })

  test('兩者皆 null → unread', () => {
    expect(mapV1StatusToV2({ isNew: null, isFinished: null })).toBe('unread')
  })
})

// ============================================================
// 8. TagCategory 驗證
// ============================================================

describe('TagCategory Schema 驗證', () => {
  test('有效的 TagCategory 通過驗證', () => {
    const cat = createValidCategory()
    const result = validateTagCategory(cat)
    expect(result.valid).toBe(true)
  })

  test('缺少 id 時驗證失敗', () => {
    const cat = createValidCategory({ id: undefined })
    const result = validateTagCategory(cat)
    expect(result.valid).toBe(false)
  })

  test('缺少 name 時驗證失敗', () => {
    const cat = createValidCategory({ name: undefined })
    const result = validateTagCategory(cat)
    expect(result.valid).toBe(false)
  })

  test('name 超過 50 字元時驗證失敗', () => {
    const cat = createValidCategory({ name: 'a'.repeat(51) })
    const result = validateTagCategory(cat)
    expect(result.valid).toBe(false)
    expect(result.errors.some((e) => e.includes('最大長度'))).toBe(true)
  })

  test('description 超過 200 字元時驗證失敗', () => {
    const cat = createValidCategory({ description: 'a'.repeat(201) })
    const result = validateTagCategory(cat)
    expect(result.valid).toBe(false)
  })

  test('color 格式不符時驗證失敗', () => {
    const cat = createValidCategory({ color: 'red' })
    const result = validateTagCategory(cat)
    expect(result.valid).toBe(false)
  })

  test('有效的 hex 色碼通過驗證', () => {
    const cat = createValidCategory({ color: '#FF00AA' })
    const result = validateTagCategory(cat)
    expect(result.valid).toBe(true)
  })

  test('name 重複時驗證失敗', () => {
    const existing = [createValidCategory({ id: 'cat_002', name: '類別' })]
    const cat = createValidCategory({ id: 'cat_003', name: '類別' })
    const result = validateTagCategory(cat, existing)
    expect(result.valid).toBe(false)
    expect(result.errors.some((e) => e.includes('已存在'))).toBe(true)
  })

  test('同 id 的 name 不算重複（自身更新）', () => {
    const existing = [createValidCategory({ id: 'cat_001', name: '類別' })]
    const cat = createValidCategory({ id: 'cat_001', name: '類別' })
    const result = validateTagCategory(cat, existing)
    expect(result.valid).toBe(true)
  })

  test('null 輸入驗證失敗', () => {
    const result = validateTagCategory(null)
    expect(result.valid).toBe(false)
  })

  test('常數 TAG_CATEGORY_NAME_MAX_LENGTH 為 50', () => {
    expect(TAG_CATEGORY_NAME_MAX_LENGTH).toBe(50)
  })

  test('常數 TAG_CATEGORY_DESCRIPTION_MAX_LENGTH 為 200', () => {
    expect(TAG_CATEGORY_DESCRIPTION_MAX_LENGTH).toBe(200)
  })

  test('常數 DEFAULT_COLOR 為 #808080', () => {
    expect(DEFAULT_COLOR).toBe('#808080')
  })
})

// ============================================================
// 9. Tag 驗證
// ============================================================

describe('Tag Schema 驗證', () => {
  test('有效的 Tag 通過驗證', () => {
    const tag = createValidTag()
    const result = validateTag(tag)
    expect(result.valid).toBe(true)
  })

  test('缺少 id 時驗證失敗', () => {
    const tag = createValidTag({ id: undefined })
    const result = validateTag(tag)
    expect(result.valid).toBe(false)
  })

  test('缺少 name 時驗證失敗', () => {
    const tag = createValidTag({ name: undefined })
    const result = validateTag(tag)
    expect(result.valid).toBe(false)
  })

  test('缺少 categoryId 時驗證失敗', () => {
    const tag = createValidTag({ categoryId: undefined })
    const result = validateTag(tag)
    expect(result.valid).toBe(false)
  })

  test('name 超過 50 字元時驗證失敗', () => {
    const tag = createValidTag({ name: 'a'.repeat(51) })
    const result = validateTag(tag)
    expect(result.valid).toBe(false)
  })

  test('同 category 內 name 重複（大小寫不敏感）時驗證失敗', () => {
    const existing = [createValidTag({ id: 'tag_002', name: 'Novel', categoryId: 'cat_001' })]
    const tag = createValidTag({ id: 'tag_003', name: 'novel', categoryId: 'cat_001' })
    const result = validateTag(tag, existing)
    expect(result.valid).toBe(false)
    expect(result.errors.some((e) => e.includes('大小寫不敏感'))).toBe(true)
  })

  test('不同 category 的相同 name 不算重複', () => {
    const existing = [createValidTag({ id: 'tag_002', name: '小說', categoryId: 'cat_002' })]
    const tag = createValidTag({ id: 'tag_003', name: '小說', categoryId: 'cat_001' })
    const result = validateTag(tag, existing)
    expect(result.valid).toBe(true)
  })

  test('同 id 的 name 不算重複（自身更新）', () => {
    const existing = [createValidTag({ id: 'tag_001', name: '小說', categoryId: 'cat_001' })]
    const tag = createValidTag({ id: 'tag_001', name: '小說', categoryId: 'cat_001' })
    const result = validateTag(tag, existing)
    expect(result.valid).toBe(true)
  })

  test('null 輸入驗證失敗', () => {
    const result = validateTag(null)
    expect(result.valid).toBe(false)
  })

  test('常數 TAG_NAME_MAX_LENGTH 為 50', () => {
    expect(TAG_NAME_MAX_LENGTH).toBe(50)
  })
})

// ============================================================
// 10. tagIds 驗證
// ============================================================

describe('tagIds 驗證', () => {
  test('空陣列通過驗證', () => {
    const result = validateTagIds([])
    expect(result.valid).toBe(true)
  })

  test('有效的 string 陣列通過驗證', () => {
    const result = validateTagIds(['tag_001', 'tag_002'])
    expect(result.valid).toBe(true)
  })

  test('非陣列輸入驗證失敗', () => {
    const result = validateTagIds('not_array')
    expect(result.valid).toBe(false)
  })

  test('包含非 string 元素時驗證失敗', () => {
    const result = validateTagIds(['tag_001', 123])
    expect(result.valid).toBe(false)
  })

  test('超過 MAX_TAGS_PER_BOOK 上限時驗證失敗', () => {
    const tagIds = Array.from({ length: 101 }, (_, i) => `tag_${i}`)
    const result = validateTagIds(tagIds)
    expect(result.valid).toBe(false)
  })

  test('常數 MAX_TAGS_PER_BOOK 為 100', () => {
    expect(MAX_TAGS_PER_BOOK).toBe(100)
  })
})
