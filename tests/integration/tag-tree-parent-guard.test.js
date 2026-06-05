/**
 * Tag 樹狀 model parentId 防護 integration（場景組 B）
 *
 * 涵蓋範圍（SPEC-010 §3 場景組 B）：
 * - B1 循環引用被拒（含自我引用 B1-self）
 * - B2 超 MAX_DEPTH 被拒 / B2-edge 邊界內允許
 * - B3 update 路徑驗證 parentId 存在性 / B3-create create 路徑亦驗
 *
 * TDD Phase 2（Red）：實作由 Phase 3 完成。對應 Ticket 0.20.0-W2-007。
 *
 * 設計考量：雙寫入路徑（create + update）皆須呼叫 validate（SPEC §2.4）。
 *
 * @jest-environment jsdom
 */

const TagStorageAdapter = require('src/storage/adapters/tag-storage-adapter')
const {
  setupChromeStorageMock,
  makeLinearDepthFixture
} = require('./fixtures/tag-tree-fixture')

describe('Tag 樹狀 parentId 防護 integration（場景組 B）', () => {
  afterEach(() => { delete global.chrome; jest.clearAllMocks() })

  describe('B1: 循環引用被拒', () => {
    it('A→B→C 鏈，moveTagCategory(A, C) 回 circular_reference 且樹不變', async () => {
      setupChromeStorageMock({
        [TagStorageAdapter.STORAGE_KEYS.CATEGORIES]: [
          { id: 'A', name: 'A', parentId: null },
          { id: 'B', name: 'B', parentId: 'A' },
          { id: 'C', name: 'C', parentId: 'B' }
        ]
      })
      const result = await TagStorageAdapter.moveTagCategory('A', 'C')
      expect(result.success).toBe(false)
      expect(result.error).toBe('circular_reference')
    })

    it('B1-self: 自我引用 moveTagCategory(A, A) 回 circular_reference', async () => {
      setupChromeStorageMock({
        [TagStorageAdapter.STORAGE_KEYS.CATEGORIES]: [
          { id: 'A', name: 'A', parentId: null }
        ]
      })
      const result = await TagStorageAdapter.moveTagCategory('A', 'A')
      expect(result.success).toBe(false)
      expect(result.error).toBe('circular_reference')
    })
  })

  describe('B2: MAX_DEPTH 防護', () => {
    it('depth=3 葉下建子（達 depth=4）回 max_depth_exceeded', async () => {
      setupChromeStorageMock({
        [TagStorageAdapter.STORAGE_KEYS.CATEGORIES]: makeLinearDepthFixture()
      })
      const result = await TagStorageAdapter.createTagCategory({ name: 'depth4', parentId: 'd3' })
      expect(result.success).toBe(false)
      expect(result.error).toBe('max_depth_exceeded')
    })

    it('B2-edge: depth=2 下建子（depth=3）允許', async () => {
      setupChromeStorageMock({
        [TagStorageAdapter.STORAGE_KEYS.CATEGORIES]: makeLinearDepthFixture().slice(0, 3)
      })
      const result = await TagStorageAdapter.createTagCategory({ name: 'newleaf', parentId: 'd2' })
      expect(result.success).toBe(true)
    })
  })

  describe('B3: 雙寫入路徑驗證 parentId 存在性', () => {
    it('update parentId→不存在 id 回 invalid_parent_reference 且不寫入', async () => {
      const ctx = setupChromeStorageMock({
        [TagStorageAdapter.STORAGE_KEYS.CATEGORIES]: [
          { id: 'A', name: 'A', parentId: null }
        ]
      })
      const result = await TagStorageAdapter.updateTagCategory('A', { parentId: 'ghost' })
      expect(result.success).toBe(false)
      expect(result.error).toBe('invalid_parent_reference')
      const stored = ctx.store[TagStorageAdapter.STORAGE_KEYS.CATEGORIES]
      expect(stored.find(c => c.id === 'A').parentId).toBe(null)
    })

    it('B3-create: create parentId→不存在 id 回 invalid_parent_reference', async () => {
      setupChromeStorageMock({
        [TagStorageAdapter.STORAGE_KEYS.CATEGORIES]: []
      })
      const result = await TagStorageAdapter.createTagCategory({ name: 'x', parentId: 'ghost' })
      expect(result.success).toBe(false)
      expect(result.error).toBe('invalid_parent_reference')
    })
  })
})
