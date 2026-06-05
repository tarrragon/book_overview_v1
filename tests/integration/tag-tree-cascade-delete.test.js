/**
 * Tag 樹狀 model cascade 分層刪除 integration（場景組 C）
 *
 * 涵蓋範圍（SPEC-010 §3 場景組 C + §4 Q1/cascade_partial）：
 * - C1 刪非葉預設禁止（has_children）
 * - C2 刪葉 tag 轉 Uncategorized / C2-lazy 惰性建立 Uncategorized
 * - C3 子樹刪除 opt-in / C3-noopt 無 opt-in 禁止
 * - C4 isSystem 不可刪 / C4-uncat Uncategorized 不可刪
 * - C-rollback cascade 中途失敗回滾（cascade_partial）
 *
 * TDD Phase 2（Red）：實作由 Phase 3 完成。對應 Ticket 0.20.0-W2-007。
 *
 * @jest-environment jsdom
 */

const TagStorageAdapter = require('src/storage/adapters/tag-storage-adapter')
const { setupChromeStorageMock } = require('./fixtures/tag-tree-fixture')

const K = () => TagStorageAdapter.STORAGE_KEYS

describe('Tag 樹狀 cascade 刪除 integration（場景組 C）', () => {
  afterEach(() => { delete global.chrome; jest.clearAllMocks() })

  describe('C1: 刪非葉預設禁止', () => {
    it('刪「0 總類」（有子「00 特藏」）回 has_children 含 hint', async () => {
      setupChromeStorageMock({
        [K().CATEGORIES]: [
          { id: 'sys_cat_0', name: '0 總類', parentId: null, isSystem: false },
          { id: 'sys_cat_00', name: '00 特藏', parentId: 'sys_cat_0', isSystem: false }
        ]
      })
      const result = await TagStorageAdapter.deleteTagCategory('sys_cat_0')
      expect(result.success).toBe(false)
      expect(result.error).toBe('has_children')
      expect(result.hint).toBeDefined()
    })
  })

  describe('C2: 刪葉 tag 轉 Uncategorized', () => {
    it('刪葉「001 善本」，掛載的 3 tag 轉至 Uncategorized，tag 不刪', async () => {
      const ctx = setupChromeStorageMock({
        [K().CATEGORIES]: [
          { id: 'leaf', name: '001 善本', parentId: null, isSystem: false },
          { id: 'sys_cat_uncategorized', name: 'Uncategorized', parentId: null, isSystem: true }
        ],
        [K().TAGS]: [
          { id: 't1', name: 'tag1', categoryId: 'leaf' },
          { id: 't2', name: 'tag2', categoryId: 'leaf' },
          { id: 't3', name: 'tag3', categoryId: 'leaf' }
        ]
      })
      const result = await TagStorageAdapter.deleteTagCategory('leaf')
      expect(result.success).toBe(true)
      const tags = ctx.store[K().TAGS]
      expect(tags.length).toBe(3)
      tags.forEach(t => expect(t.categoryId).toBe('sys_cat_uncategorized'))
    })

    it('C2-lazy: Uncategorized 不存在則惰性建立後轉移', async () => {
      const ctx = setupChromeStorageMock({
        [K().CATEGORIES]: [
          { id: 'leaf', name: '001 善本', parentId: null, isSystem: false }
        ],
        [K().TAGS]: [
          { id: 't1', name: 'tag1', categoryId: 'leaf' }
        ]
      })
      const result = await TagStorageAdapter.deleteTagCategory('leaf')
      expect(result.success).toBe(true)
      const cats = ctx.store[K().CATEGORIES]
      expect(cats.find(c => c.id === 'sys_cat_uncategorized')).toBeDefined()
    })
  })

  describe('C3: 子樹刪除 opt-in', () => {
    it('cascadeSubtree=true 刪整子樹', async () => {
      const ctx = setupChromeStorageMock({
        [K().CATEGORIES]: [
          { id: 'mine', name: '我的分類', parentId: null, isSystem: false },
          { id: 'sub1', name: 'sub1', parentId: 'mine', isSystem: false },
          { id: 'sub2', name: 'sub2', parentId: 'mine', isSystem: false }
        ],
        [K().TAGS]: []
      })
      const result = await TagStorageAdapter.deleteTagCategory('mine', { cascadeSubtree: true })
      expect(result.success).toBe(true)
      const cats = ctx.store[K().CATEGORIES]
      expect(cats.find(c => c.id === 'mine')).toBeUndefined()
      expect(cats.find(c => c.id === 'sub1')).toBeUndefined()
    })

    it('C3-noopt: 自建非葉無 cascadeSubtree 仍禁止', async () => {
      setupChromeStorageMock({
        [K().CATEGORIES]: [
          { id: 'mine', name: '我的分類', parentId: null, isSystem: false },
          { id: 'sub1', name: 'sub1', parentId: 'mine', isSystem: false }
        ]
      })
      const result = await TagStorageAdapter.deleteTagCategory('mine')
      expect(result.success).toBe(false)
      expect(result.error).toBe('has_children')
    })
  })

  describe('C4: isSystem 保護', () => {
    it('刪 isSystem 葉節點回 system_protected', async () => {
      setupChromeStorageMock({
        [K().CATEGORIES]: [
          { id: 'sys_cat_0', name: '0 總類', parentId: null, isSystem: true }
        ]
      })
      const result = await TagStorageAdapter.deleteTagCategory('sys_cat_0')
      expect(result.success).toBe(false)
      expect(result.error).toBe('system_protected')
    })

    it('C4 含 cascadeSubtree 對 isSystem 仍 system_protected', async () => {
      setupChromeStorageMock({
        [K().CATEGORIES]: [
          { id: 'sys_cat_0', name: '0 總類', parentId: null, isSystem: true }
        ]
      })
      const result = await TagStorageAdapter.deleteTagCategory('sys_cat_0', { cascadeSubtree: true })
      expect(result.success).toBe(false)
      expect(result.error).toBe('system_protected')
    })

    it('C4-uncat: Uncategorized isSystem 不可刪', async () => {
      setupChromeStorageMock({
        [K().CATEGORIES]: [
          { id: 'sys_cat_uncategorized', name: 'Uncategorized', parentId: null, isSystem: true }
        ]
      })
      const result = await TagStorageAdapter.deleteTagCategory('sys_cat_uncategorized')
      expect(result.success).toBe(false)
      expect(result.error).toBe('system_protected')
    })
  })

  describe('C-rollback: cascade 中途失敗回滾', () => {
    it('子樹刪除途中 storage 失敗 → cascade_partial，rolledBack:true，子樹回滾', async () => {
      const ctx = setupChromeStorageMock({
        [K().CATEGORIES]: [
          { id: 'mine', name: '我的分類', parentId: null, isSystem: false },
          { id: 'sub1', name: 'sub1', parentId: 'mine', isSystem: false }
        ]
      })
      // Phase 3a 補料：storage.set 第 N 次失敗注入能力
      global.chrome.storage.local.set = jest.fn(() => Promise.reject(new Error('storage failure')))
      const result = await TagStorageAdapter.deleteTagCategory('mine', { cascadeSubtree: true })
      expect(result.success).toBe(false)
      expect(result.error).toBe('cascade_partial')
      expect(result.rolledBack).toBe(true)
      // 回滾：原節點仍在（Phase 3 補料驗 ctx.store 內容；此處驗 result 契約）
      expect(ctx.store[K().CATEGORIES].find(c => c.id === 'mine')).toBeDefined()
    })
  })
})
