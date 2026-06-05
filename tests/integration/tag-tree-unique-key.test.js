/**
 * Tag 樹狀 model 唯一鍵 integration（場景組 A：A1-A3）
 *
 * 涵蓋範圍（SPEC-010 §3 場景組 A）：
 * - A1 跨主類同名次類並存
 * - A2 同父下同名次類被拒（duplicate_name）
 * - A3-1 createTagCategory dup 檢查改 scoped（adapter:256-258）
 * - A3-2 computeMergeResult dup 檢查改 scoped（merge:917-918）
 *
 * TDD Phase 2（Red）：實作由 Phase 3 完成。對應 Ticket 0.20.0-W2-007。
 *
 * 設計考量：chrome.storage mock；無計時硬門檻；error code 字面斷言對齊 SPEC §4。
 *
 * @jest-environment jsdom
 */

const TagStorageAdapter = require('src/storage/adapters/tag-storage-adapter')
const {
  setupChromeStorageMock,
  makePresetTreeFixture
} = require('./fixtures/tag-tree-fixture')

describe('Tag 樹狀唯一鍵 integration（場景組 A）', () => {
  let ctx
  beforeEach(() => { ctx = setupChromeStorageMock() })
  afterEach(() => { ctx.restore(); jest.clearAllMocks() })

  describe('A1: 跨主類同名次類並存', () => {
    it('「0 總類」與「1 哲學類」下各建同名「總論」皆成功並存', async () => {
      setupChromeStorageMock({
        [TagStorageAdapter.STORAGE_KEYS.CATEGORIES]: makePresetTreeFixture()
      })
      const r1 = await TagStorageAdapter.createTagCategory({ name: '總論', parentId: 'sys_cat_0' })
      const r2 = await TagStorageAdapter.createTagCategory({ name: '總論', parentId: 'sys_cat_1' })
      expect(r1.success).toBe(true)
      expect(r2.success).toBe(true)
    })
  })

  describe('A2: 同父下同名次類被拒', () => {
    it('「0 總類」下重建「00 特藏」回 duplicate_name', async () => {
      setupChromeStorageMock({
        [TagStorageAdapter.STORAGE_KEYS.CATEGORIES]: makePresetTreeFixture()
      })
      const result = await TagStorageAdapter.createTagCategory({ name: '00 特藏', parentId: 'sys_cat_0' })
      expect(result.success).toBe(false)
      expect(result.error).toBe('duplicate_name')
    })
  })

  describe('A3-1: createTagCategory dup 檢查改 scoped', () => {
    it('不同 parent 同名建立不觸發 duplicate_name（殘留全域比對則失敗）', async () => {
      setupChromeStorageMock({
        [TagStorageAdapter.STORAGE_KEYS.CATEGORIES]: [
          { id: 'a', name: '索引', parentId: 'sys_cat_0' }
        ]
      })
      const result = await TagStorageAdapter.createTagCategory({ name: '索引', parentId: 'sys_cat_1' })
      expect(result.success).toBe(true)
      expect(result.error).toBeUndefined()
    })
  })

  describe('A3-2: computeMergeResult dup 檢查改 scoped', () => {
    it('匯入含不同 parent 同名 category，merge 後二者皆保留不被誤併', () => {
      const localCategories = [
        { id: 'l1', name: '總論', parentId: 'sys_cat_0' }
      ]
      const incomingCategories = [
        { id: 'i1', name: '總論', parentId: 'sys_cat_1' }
      ]
      const result = TagStorageAdapter.computeMergeResult({
        localCategories,
        incomingCategories,
        localTags: [],
        incomingTags: []
      })
      // scoped 後不同 parent 同名應各自保留（不映射至同一 id）
      const merged = result.categories || result.mergedCategories || []
      const names = merged.filter(c => c.name === '總論')
      expect(names.length).toBe(2)
    })
  })
})
