/**
 * tag-storage-adapter.computeMergeResult 合併計算純函式測試
 * TDD Phase 3b — 0.19.0-W1-047.4（IMP-D，UC-04 合併模式與 tag id 重映射）
 *
 * 測試對象：computeMergeResult 純函式（無 chrome.storage mock，注入可預測 id 產生器）
 *   - books 同 id tagIds 聯集（TC-C1~C5）
 *   - category 同名比對與重映射（TC-C6~C8）
 *   - tag 同名比對與重映射（TC-C9~C12）
 *   - 三層 id 重映射貫穿（TC-C13~C14）
 *   - 兩階段收斂（TC-C15~C16）
 *   - 邊界與防禦處理（TC-C17~C22）
 *   - 空輸入（TC-C23）
 *
 * 規格來源：docs/work-logs/v0/v0.19/v0.19.0/tickets/0.19.0-W1-047.4-feature-spec.md
 * 測試遵循 test-assertion-design 規則：無計時硬門檻；純資料轉換以結構斷言。
 */

const TagStorageAdapter = require('src/storage/adapters/tag-storage-adapter')
const TagSchema = require('src/data-management/TagSchema')

const { computeMergeResult } = TagStorageAdapter

// --- 可預測 id 產生器工廠 ---

/**
 * 建立序列式可預測 id 產生器，斷言 remap 映射表內容
 * @returns {{ nextCategoryId: Function, nextTagId: Function }}
 */
function makeSequentialIdGenerators () {
  let catN = 0
  let tagN = 0
  return {
    nextCategoryId: () => `cat_test_${++catN}`,
    nextTagId: () => `tag_test_${++tagN}`
  }
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

const emptyLocal = () => ({ books: [], tags: [], tagCategories: [] })
const emptyIncoming = () => ({ books: [], tags: [], tagCategories: [] })

// ===========================================================================

describe('computeMergeResult — 合併計算純函式（UC-04 匯入）', () => {
  let warnSpy

  beforeEach(() => {
    warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {})
  })

  afterEach(() => {
    warnSpy.mockRestore()
  })

  // -------------------------------------------------------------------------
  // 測試群組 A：books 同 id tagIds 聯集（AC-1, AC-2, AC-16）
  // -------------------------------------------------------------------------
  describe('測試群組 A：books 同 id tagIds 聯集', () => {
    test('TC-C1 同 id tagIds 聯集去重（本地在前、新增在後）', () => {
      // 本地 book-001 tagIds [t_local_a, t_local_b]
      const local = {
        books: [makeBook('book-001', { tagIds: ['t_local_a', 't_local_b'] })],
        tags: [
          makeTag('t_local_a', '本地A', 'cat_local_1'),
          makeTag('t_local_b', '科幻', 'cat_local_1')
        ],
        tagCategories: [makeCategory('cat_local_1', '書籍類型')]
      }
      // incoming book-001 tagIds [t_imp_x, t_imp_y]；t_imp_x 同名「科幻」→ 映射 t_local_b、t_imp_y 新建
      const incoming = {
        books: [makeBook('book-001', { tagIds: ['t_imp_x', 't_imp_y'] })],
        tags: [
          makeTag('t_imp_x', '科幻', 'c_imp'),
          makeTag('t_imp_y', '歷史', 'c_imp')
        ],
        tagCategories: [makeCategory('c_imp', '書籍類型')]
      }

      const result = computeMergeResult(local, incoming, makeSequentialIdGenerators())

      const book = result.books.find(b => b.id === 'book-001')
      // 聯集：本地 [t_local_a, t_local_b] ∪ 重映射後 [t_local_b, tag_test_1]
      expect(book.tagIds).toEqual(['t_local_a', 't_local_b', 'tag_test_1'])
      // t_local_b 不重複
      expect(book.tagIds.filter(id => id === 't_local_b')).toHaveLength(1)
    })

    test('TC-C2 同 id 其餘欄位以匯入覆蓋', () => {
      const local = {
        books: [makeBook('book-001', { title: '舊', progress: 0 })],
        tags: [],
        tagCategories: []
      }
      const incoming = {
        books: [makeBook('book-001', { title: '新', progress: 50 })],
        tags: [],
        tagCategories: []
      }

      const result = computeMergeResult(local, incoming, makeSequentialIdGenerators())

      const book = result.books.find(b => b.id === 'book-001')
      expect(book.title).toBe('新')
      expect(book.progress).toBe(50)
      // tagIds 為聯集（兩側皆空）
      expect(book.tagIds).toEqual([])
    })

    test('TC-C3 新 id 直接加入，本地未匹配書原樣保留', () => {
      const local = {
        books: [makeBook('book-001'), makeBook('book-002')],
        tags: [],
        tagCategories: []
      }
      const incoming = {
        books: [makeBook('book-001'), makeBook('book-999')],
        tags: [],
        tagCategories: []
      }

      const result = computeMergeResult(local, incoming, makeSequentialIdGenerators())

      expect(result.books).toHaveLength(3)
      const ids = result.books.map(b => b.id)
      expect(ids).toEqual(expect.arrayContaining(['book-001', 'book-002', 'book-999']))
      // book-002 原樣保留
      expect(result.books.find(b => b.id === 'book-002')).toEqual(makeBook('book-002'))
    })

    test('TC-C4 本地空、incoming 非空：result.books 等於 incoming books（tagIds 經重映射）', () => {
      const local = emptyLocal()
      const incoming = {
        books: [makeBook('book-001', { tagIds: ['t_imp_a'] })],
        tags: [makeTag('t_imp_a', '科幻', 'c_imp')],
        tagCategories: [makeCategory('c_imp', '書籍類型')]
      }

      const result = computeMergeResult(local, incoming, makeSequentialIdGenerators())

      expect(result.books).toHaveLength(1)
      const book = result.books[0]
      expect(book.id).toBe('book-001')
      // tagIds 經重映射至新建本地 tag id（非 t_imp_a）
      expect(book.tagIds).toEqual(['tag_test_1'])
    })

    test('TC-C5 本地既有孤兒 tagId 原樣保留（AC-16）', () => {
      // 本地 book-001 tagIds 含 t_orphan（指向不存在的本地 tag）
      const local = {
        books: [makeBook('book-001', { tagIds: ['t_orphan'] })],
        tags: [],
        tagCategories: []
      }
      const incoming = {
        books: [makeBook('book-001', { tagIds: ['t_imp_a'] })],
        tags: [makeTag('t_imp_a', '科幻', 'c_imp')],
        tagCategories: [makeCategory('c_imp', '書籍類型')]
      }

      const result = computeMergeResult(local, incoming, makeSequentialIdGenerators())

      const book = result.books.find(b => b.id === 'book-001')
      // t_orphan 不被移除（合併不修復本地破損）
      expect(book.tagIds).toContain('t_orphan')
      // 含重映射後的 t_imp_a
      expect(book.tagIds).toContain('tag_test_1')
    })
  })

  // -------------------------------------------------------------------------
  // 測試群組 B：category 同名比對與重映射（AC-5, AC-6）
  // -------------------------------------------------------------------------
  describe('測試群組 B：category 同名比對與重映射', () => {
    test('TC-C6 category 同名保留本地 id 與屬性', () => {
      const local = {
        books: [],
        tags: [],
        tagCategories: [makeCategory('cat_local_1', '書籍類型')]
      }
      const incoming = {
        books: [],
        tags: [],
        tagCategories: [makeCategory('c_imp', '書籍類型')]
      }

      const result = computeMergeResult(local, incoming, makeSequentialIdGenerators())

      // 「書籍類型」id 仍為本地 cat_local_1
      const cat = result.tagCategories.find(c => c.name === '書籍類型')
      expect(cat.id).toBe('cat_local_1')
      // remap.categoryIdMap 含 c_imp → cat_local_1
      expect(result.remap.categoryIdMap.get('c_imp')).toBe('cat_local_1')
      // 無第二個「書籍類型」
      expect(result.tagCategories.filter(c => c.name === '書籍類型')).toHaveLength(1)
    })

    test('TC-C7 category 不存在則新建本地 id', () => {
      const local = emptyLocal()
      const incoming = {
        books: [],
        tags: [],
        tagCategories: [makeCategory('c_imp', '閱讀清單')]
      }

      const result = computeMergeResult(local, incoming, makeSequentialIdGenerators())

      const cat = result.tagCategories.find(c => c.name === '閱讀清單')
      // 新建本地 id（非沿用 c_imp）
      expect(cat.id).toBe('cat_test_1')
      // remap.categoryIdMap 含 c_imp → cat_test_1
      expect(result.remap.categoryIdMap.get('c_imp')).toBe('cat_test_1')
    })

    test('TC-C8 category 大小寫不敏感同名', () => {
      const local = {
        books: [],
        tags: [],
        tagCategories: [makeCategory('cat_local_1', 'SciFi')]
      }
      const incoming = {
        books: [],
        tags: [],
        tagCategories: [makeCategory('c_imp', 'scifi')]
      }

      const result = computeMergeResult(local, incoming, makeSequentialIdGenerators())

      // 視為同名，保留本地「SciFi」，不新建
      expect(result.tagCategories).toHaveLength(1)
      expect(result.tagCategories[0].name).toBe('SciFi')
      expect(result.remap.categoryIdMap.get('c_imp')).toBe('cat_local_1')
    })
  })

  // -------------------------------------------------------------------------
  // 測試群組 C：tag 同名比對與重映射（AC-3, AC-4, AC-7, AC-15）
  // -------------------------------------------------------------------------
  describe('測試群組 C：tag 同名比對與重映射', () => {
    test('TC-C9 tag 同 category 同名保留本地 id 與屬性', () => {
      const local = {
        books: [],
        tags: [makeTag('t_local_sci', '科幻', 'cat_local_1', { sortOrder: 3 })],
        tagCategories: [makeCategory('cat_local_1', '書籍類型')]
      }
      const incoming = {
        books: [],
        tags: [makeTag('t_imp_sci', '科幻', 'c_imp', { sortOrder: 99 })],
        tagCategories: [makeCategory('c_imp', '書籍類型')]
      }

      const result = computeMergeResult(local, incoming, makeSequentialIdGenerators())

      const tag = result.tags.find(t => t.name === '科幻')
      // id 保留本地
      expect(tag.id).toBe('t_local_sci')
      // 屬性保留本地版本（sortOrder 仍為 3）
      expect(tag.sortOrder).toBe(3)
      // remap.tagIdMap 含 t_imp_sci → t_local_sci
      expect(result.remap.tagIdMap.get('t_imp_sci')).toBe('t_local_sci')
      // 無重複「科幻」tag
      expect(result.tags.filter(t => t.name === '科幻')).toHaveLength(1)
    })

    test('TC-C10 tag 大小寫不敏感同名（場景 4 易漏邊界）', () => {
      const local = {
        books: [],
        tags: [makeTag('t_local_1', 'SciFi', 'cat_local_1')],
        tagCategories: [makeCategory('cat_local_1', '書籍類型')]
      }
      const incoming = {
        books: [],
        tags: [makeTag('t_imp_1', 'scifi', 'c_imp')],
        tagCategories: [makeCategory('c_imp', '書籍類型')]
      }

      const result = computeMergeResult(local, incoming, makeSequentialIdGenerators())

      // 視為同名保留本地「SciFi」，不新建第二個
      expect(result.tags.filter(t => t.name.toLowerCase() === 'scifi')).toHaveLength(1)
      expect(result.tags[0].name).toBe('SciFi')
      expect(result.remap.tagIdMap.get('t_imp_1')).toBe('t_local_1')
    })

    test('TC-C11 tag 不存在則新建並重映射', () => {
      const local = {
        books: [],
        tags: [],
        tagCategories: [makeCategory('cat_local_1', '書籍類型')]
      }
      const incoming = {
        books: [],
        tags: [makeTag('t_imp_his', '歷史', 'c_imp')],
        tagCategories: [makeCategory('c_imp', '書籍類型')]
      }

      const result = computeMergeResult(local, incoming, makeSequentialIdGenerators())

      const tag = result.tags.find(t => t.name === '歷史')
      // 新建本地 id（非沿用 t_imp_his）
      expect(tag.id).toBe('tag_test_1')
      // categoryId 指向重映射後本地 category（cat_local_1，同名映射）
      expect(tag.categoryId).toBe('cat_local_1')
      // remap.tagIdMap 含 t_imp_his → tag_test_1
      expect(result.remap.tagIdMap.get('t_imp_his')).toBe('tag_test_1')
    })

    test('TC-C12 同名比對鍵含 categoryId（不同 category 同名 tag 不誤判）', () => {
      // 本地 category X 下 tag「通用」
      const local = {
        books: [],
        tags: [makeTag('t_local_x', '通用', 'cat_local_x')],
        tagCategories: [
          makeCategory('cat_local_x', '分類X'),
          makeCategory('cat_local_y', '分類Y')
        ]
      }
      // incoming category Y（重映射至 cat_local_y）下 tag「通用」
      const incoming = {
        books: [],
        tags: [makeTag('t_imp_y', '通用', 'c_imp_y')],
        tagCategories: [makeCategory('c_imp_y', '分類Y')]
      }

      const result = computeMergeResult(local, incoming, makeSequentialIdGenerators())

      // incoming「通用」不誤判為同名本地 tag（鍵 = categoryId + name），新建本地 tag
      expect(result.tags.filter(t => t.name === '通用')).toHaveLength(2)
      const impTag = result.tags.find(t => t.id === 'tag_test_1')
      expect(impTag).toBeDefined()
      expect(impTag.categoryId).toBe('cat_local_y')
    })
  })

  // -------------------------------------------------------------------------
  // 測試群組 D：三層 id 重映射貫穿（AC-8，核心 TC）
  // -------------------------------------------------------------------------
  describe('測試群組 D：三層 id 重映射貫穿', () => {
    test('TC-C13 category→tag→book 三層 id 一致重映射', () => {
      const local = emptyLocal()
      const incoming = {
        books: [makeBook('book-001', { tagIds: ['t_imp'] })],
        tags: [makeTag('t_imp', '科幻', 'c_imp')],
        tagCategories: [makeCategory('c_imp', '書籍類型')]
      }

      const result = computeMergeResult(local, incoming, makeSequentialIdGenerators())

      // 新建 category id cat_test_1
      const cat = result.tagCategories.find(c => c.name === '書籍類型')
      expect(cat.id).toBe('cat_test_1')
      // 新建 tag id tag_test_1，categoryId 指向 cat_test_1（非 c_imp）
      const tag = result.tags.find(t => t.name === '科幻')
      expect(tag.id).toBe('tag_test_1')
      expect(tag.categoryId).toBe('cat_test_1')
      // book-001 tagIds 為 [tag_test_1]（非 t_imp）
      const book = result.books.find(b => b.id === 'book-001')
      expect(book.tagIds).toEqual(['tag_test_1'])
      // remap 映射表完整
      expect(result.remap.categoryIdMap.get('c_imp')).toBe('cat_test_1')
      expect(result.remap.tagIdMap.get('t_imp')).toBe('tag_test_1')
    })

    test('TC-C14 兩階段順序：先 category 後 tag（tag categoryId 為重映射後本地 id）', () => {
      // incoming category 同名映射至本地 + tag 新建
      const local = {
        books: [],
        tags: [],
        tagCategories: [makeCategory('cat_local_1', '書籍類型')]
      }
      const incoming = {
        books: [],
        tags: [makeTag('t_imp', '科幻', 'c_imp')],
        tagCategories: [makeCategory('c_imp', '書籍類型')]
      }

      const result = computeMergeResult(local, incoming, makeSequentialIdGenerators())

      const tag = result.tags.find(t => t.name === '科幻')
      // tag categoryId 為「重映射後本地 categoryId」（消費已完成的 categoryIdMap）
      expect(tag.categoryId).toBe('cat_local_1')
    })
  })

  // -------------------------------------------------------------------------
  // 測試群組 E：兩階段收斂（AC-15）
  // -------------------------------------------------------------------------
  describe('測試群組 E：兩階段收斂', () => {
    test('TC-C15 兩個 incoming category 收斂至同一本地 category', () => {
      const local = {
        books: [],
        tags: [],
        tagCategories: [makeCategory('cat_local_1', '自訂標籤')]
      }
      const incoming = {
        books: [],
        tags: [],
        tagCategories: [
          makeCategory('c_imp_1', '自訂標籤'),
          makeCategory('c_imp_2', '自訂標籤')
        ]
      }

      const result = computeMergeResult(local, incoming, makeSequentialIdGenerators())

      // c_imp_1、c_imp_2 皆映射至同一本地 category id
      expect(result.remap.categoryIdMap.get('c_imp_1')).toBe('cat_local_1')
      expect(result.remap.categoryIdMap.get('c_imp_2')).toBe('cat_local_1')
      // 結果無重複「自訂標籤」
      expect(result.tagCategories.filter(c => c.name === '自訂標籤')).toHaveLength(1)
    })

    test('TC-C16 收斂後其下同名 tag 不重複', () => {
      // 承 TC-C15：c_imp_1 下 tag「科幻」、c_imp_2 下也 tag「科幻」
      const local = {
        books: [],
        tags: [],
        tagCategories: [makeCategory('cat_local_1', '自訂標籤')]
      }
      const incoming = {
        books: [],
        tags: [
          makeTag('t_imp_sci_1', '科幻', 'c_imp_1'),
          makeTag('t_imp_sci_2', '科幻', 'c_imp_2')
        ],
        tagCategories: [
          makeCategory('c_imp_1', '自訂標籤'),
          makeCategory('c_imp_2', '自訂標籤')
        ]
      }

      const result = computeMergeResult(local, incoming, makeSequentialIdGenerators())

      // result.tags 僅一個「科幻」（兩個 incoming 收斂單次新建）
      expect(result.tags.filter(t => t.name === '科幻')).toHaveLength(1)
      // 兩個 incoming tag id 皆映射至同一本地 tag id
      const mapped1 = result.remap.tagIdMap.get('t_imp_sci_1')
      const mapped2 = result.remap.tagIdMap.get('t_imp_sci_2')
      expect(mapped1).toBe(mapped2)
    })
  })

  // -------------------------------------------------------------------------
  // 測試群組 F：邊界與防禦處理（AC-14，§4 錯誤處理）
  // -------------------------------------------------------------------------
  describe('測試群組 F：邊界與防禦處理', () => {
    test('TC-C17 book 缺 id 跳過並記錄 warn', () => {
      const local = emptyLocal()
      const incoming = {
        books: [
          makeBook('book-001'),
          { title: '無 id 書籍', tagIds: [] } // 缺 id
        ],
        tags: [],
        tagCategories: []
      }

      const result = computeMergeResult(local, incoming, makeSequentialIdGenerators())

      // 該書不進 result.books，其餘正常合併
      expect(result.books).toHaveLength(1)
      expect(result.books[0].id).toBe('book-001')
      // warn 被呼叫且含元件名
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('[tag-storage-adapter]')
      )
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('book 缺 id 跳過')
      )
    })

    test('TC-C18 book tagIds 含無法重映射的 id 過濾', () => {
      const local = emptyLocal()
      const incoming = {
        // book-001 tagIds 含一個既非本地、又不在 incoming tags 的孤兒 id
        books: [makeBook('book-001', { tagIds: ['t_imp_valid', 't_imp_orphan'] })],
        tags: [makeTag('t_imp_valid', '科幻', 'c_imp')],
        tagCategories: [makeCategory('c_imp', '書籍類型')]
      }

      const result = computeMergeResult(local, incoming, makeSequentialIdGenerators())

      const book = result.books.find(b => b.id === 'book-001')
      // 孤兒 id 不出現在結果
      expect(book.tagIds).not.toContain('t_imp_orphan')
      // 有效 tag 經重映射保留
      expect(book.tagIds).toEqual(['tag_test_1'])
      // warn 記錄
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('無法重映射')
      )
    })

    test('TC-C19 tag categoryId 在 incoming 找不到對應 category → 歸入「未分類」', () => {
      const local = emptyLocal()
      const incoming = {
        books: [],
        // tag 的 categoryId 在 incoming tagCategories 內無對應
        tags: [makeTag('t_imp', '科幻', 'c_missing')],
        tagCategories: []
      }

      const result = computeMergeResult(local, incoming, makeSequentialIdGenerators())

      // 建立「未分類」category
      const uncategorized = result.tagCategories.find(c => c.name === '未分類')
      expect(uncategorized).toBeDefined()
      // tag 歸入「未分類」
      const tag = result.tags.find(t => t.name === '科幻')
      expect(tag.categoryId).toBe(uncategorized.id)
    })

    test('TC-C19b 本地已有「未分類」時匯入孤兒 tag 映射至本地「未分類」', () => {
      const local = {
        books: [],
        tags: [],
        tagCategories: [makeCategory('cat_local_uncat', '未分類')]
      }
      const incoming = {
        books: [],
        tags: [makeTag('t_imp', '科幻', 'c_missing')],
        tagCategories: []
      }

      const result = computeMergeResult(local, incoming, makeSequentialIdGenerators())

      // 「未分類」參與同名比對，不新建
      expect(result.tagCategories.filter(c => c.name === '未分類')).toHaveLength(1)
      const tag = result.tags.find(t => t.name === '科幻')
      expect(tag.categoryId).toBe('cat_local_uncat')
    })

    test('TC-C20 tag/category name 超 50 字元截斷', () => {
      const longName = 'A'.repeat(60)
      const local = emptyLocal()
      const incoming = {
        books: [],
        tags: [],
        tagCategories: [makeCategory('c_imp', longName)]
      }

      const result = computeMergeResult(local, incoming, makeSequentialIdGenerators())

      const cat = result.tagCategories[0]
      // 截斷至 TagSchema 上限（50）
      expect(cat.name.length).toBe(TagSchema.TAG_CATEGORY_NAME_MAX_LENGTH)
    })

    test('TC-C21 book tagIds 聯集後超 100 截斷', () => {
      // 本地 book-001 有 60 個 tagIds
      const localTagIds = Array.from({ length: 60 }, (_, i) => `t_local_${i}`)
      const localTags = localTagIds.map((id, i) =>
        makeTag(id, `本地標籤${i}`, 'cat_local_1')
      )
      // incoming book-001 有 60 個重映射後不同的 tagIds
      const incomingTagIds = Array.from({ length: 60 }, (_, i) => `t_imp_${i}`)
      const incomingTags = incomingTagIds.map((id, i) =>
        makeTag(id, `匯入標籤${i}`, 'c_imp')
      )

      const local = {
        books: [makeBook('book-001', { tagIds: localTagIds })],
        tags: localTags,
        tagCategories: [makeCategory('cat_local_1', '書籍類型')]
      }
      const incoming = {
        books: [makeBook('book-001', { tagIds: incomingTagIds })],
        tags: incomingTags,
        tagCategories: [makeCategory('c_imp', '書籍類型')]
      }

      const result = computeMergeResult(local, incoming, makeSequentialIdGenerators())

      const book = result.books.find(b => b.id === 'book-001')
      // 截斷至 MAX_TAGS_PER_BOOK（100）
      expect(book.tagIds.length).toBe(TagSchema.MAX_TAGS_PER_BOOK)
      // warn 記錄
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('聯集超')
      )
    })

    test('TC-C22 純函式可重現性（AC-9）：相同輸入連續兩次輸出相同', () => {
      const local = {
        books: [makeBook('book-001', { tagIds: ['t_local_a'] })],
        tags: [makeTag('t_local_a', '科幻', 'cat_local_1')],
        tagCategories: [makeCategory('cat_local_1', '書籍類型')]
      }
      const incoming = {
        books: [makeBook('book-002', { tagIds: ['t_imp_b'] })],
        tags: [makeTag('t_imp_b', '歷史', 'c_imp')],
        tagCategories: [makeCategory('c_imp', '閱讀清單')]
      }

      const result1 = computeMergeResult(local, incoming, makeSequentialIdGenerators())
      const result2 = computeMergeResult(local, incoming, makeSequentialIdGenerators())

      // 兩次輸出 books/tags/tagCategories 相同（注入相同序列產生器）
      expect(result1.books).toEqual(result2.books)
      expect(result1.tags).toEqual(result2.tags)
      expect(result1.tagCategories).toEqual(result2.tagCategories)
    })
  })

  // -------------------------------------------------------------------------
  // 測試群組 G：空輸入（AC-13）
  // -------------------------------------------------------------------------
  describe('測試群組 G：空輸入', () => {
    test('TC-C23 空匯入結果等於本地原樣', () => {
      const local = {
        books: [makeBook('book-001'), makeBook('book-002')],
        tags: [makeTag('t_local_1', '科幻', 'cat_local_1')],
        tagCategories: [makeCategory('cat_local_1', '書籍類型')]
      }
      const incoming = emptyIncoming()

      const result = computeMergeResult(local, incoming, makeSequentialIdGenerators())

      // result 各集合等於對應本地集合（無新增、無刪除）
      expect(result.books).toEqual(local.books)
      expect(result.tags).toEqual(local.tags)
      expect(result.tagCategories).toEqual(local.tagCategories)
      // remap 兩 map 皆空
      expect(result.remap.categoryIdMap.size).toBe(0)
      expect(result.remap.tagIdMap.size).toBe(0)
    })
  })
})
