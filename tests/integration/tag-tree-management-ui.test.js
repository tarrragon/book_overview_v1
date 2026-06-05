/**
 * Tag 樹狀 model Tag 管理 UI 服務契約 integration（場景組 F）
 *
 * 涵蓋範圍（SPEC-010 §2.5 §3 場景組 F + §4 Q2）：
 * - F1 rename 兄弟唯一鍵衝突 / F1-ok 不同父同名允許
 * - F2 搜尋含子樹聚合 / F2-no includeSubtree=false 僅直掛
 * - F3 batchMoveTags 全成功 / F3-partial 部分失敗
 * - F-batchDel batchDeleteTags 回報 deleted/failed
 * - F-move-depth moveTagCategory 子樹超深被拒（Q2）
 *
 * TDD Phase 2（Red）：實作由 Phase 3 完成。對應 Ticket 0.20.0-W2-007。
 *
 * @jest-environment jsdom
 */

const TagStorageAdapter = require('src/storage/adapters/tag-storage-adapter')
const { setupChromeStorageMock } = require('./fixtures/tag-tree-fixture')

const K = () => TagStorageAdapter.STORAGE_KEYS

describe('Tag 樹狀管理 UI 服務 integration（場景組 F）', () => {
  afterEach(() => { delete global.chrome; jest.clearAllMocks() })

  describe('F1: rename 兄弟唯一鍵衝突', () => {
    it('將「01 目錄學」rename 為「00 特藏」回 duplicate_name', async () => {
      setupChromeStorageMock({
        [K().CATEGORIES]: [
          { id: 'sys_cat_0', name: '0 總類', parentId: null },
          { id: 'c00', name: '00 特藏', parentId: 'sys_cat_0' },
          { id: 'c01', name: '01 目錄學', parentId: 'sys_cat_0' }
        ]
      })
      const result = await TagStorageAdapter.renameTagCategory('c01', '00 特藏')
      expect(result.success).toBe(false)
      expect(result.error).toBe('duplicate_name')
    })

    it('F1-ok: rename 使其與不同 parent 子同名 → 允許', async () => {
      setupChromeStorageMock({
        [K().CATEGORIES]: [
          { id: 'p1', name: 'P1', parentId: null },
          { id: 'p2', name: 'P2', parentId: null },
          { id: 'a', name: '索引', parentId: 'p1' },
          { id: 'b', name: '目錄', parentId: 'p2' }
        ]
      })
      const result = await TagStorageAdapter.renameTagCategory('b', '索引')
      expect(result.success).toBe(true)
    })
  })

  describe('F2: 搜尋含子樹聚合', () => {
    it('includeSubtree=true 聚合根直掛 + 子樹下 Book/tag', async () => {
      setupChromeStorageMock({
        [K().CATEGORIES]: [
          { id: 'sys_cat_0', name: '0 總類', parentId: null },
          { id: 'c00', name: '00 特藏', parentId: 'sys_cat_0' }
        ],
        [K().TAGS]: [
          { id: 't_root', name: 'tag-root', categoryId: 'sys_cat_0' },
          { id: 't_sub', name: 'tag-sub', categoryId: 'c00' }
        ]
      })
      const result = await TagStorageAdapter.searchTags('0 總類', { includeSubtree: true })
      const tagIds = result.tags.map(t => t.id)
      expect(tagIds).toContain('t_root')
      expect(tagIds).toContain('t_sub')
    })

    it('F2-no: includeSubtree=false 僅根直掛', async () => {
      setupChromeStorageMock({
        [K().CATEGORIES]: [
          { id: 'sys_cat_0', name: '0 總類', parentId: null },
          { id: 'c00', name: '00 特藏', parentId: 'sys_cat_0' }
        ],
        [K().TAGS]: [
          { id: 't_root', name: 'tag-root', categoryId: 'sys_cat_0' },
          { id: 't_sub', name: 'tag-sub', categoryId: 'c00' }
        ]
      })
      const result = await TagStorageAdapter.searchTags('0 總類', { includeSubtree: false })
      const tagIds = result.tags.map(t => t.id)
      expect(tagIds).toContain('t_root')
      expect(tagIds).not.toContain('t_sub')
    })
  })

  describe('F3: batchMoveTags', () => {
    it('全成功 batchMoveTags 回 {moved:5, failed:0}', async () => {
      const ids = ['t1', 't2', 't3', 't4', 't5']
      setupChromeStorageMock({
        [K().CATEGORIES]: [{ id: 'c02', name: '02 資訊科學', parentId: null }],
        [K().TAGS]: ids.map(id => ({ id, name: id, categoryId: 'old' }))
      })
      const result = await TagStorageAdapter.batchMoveTags(ids, 'c02')
      expect(result.moved).toBe(5)
      expect(result.failed).toBe(0)
    })

    it('F3-partial: 目標其一不存在 → 部分失敗計數', async () => {
      const ids = ['t1', 't2', 't3', 't4', 't5']
      setupChromeStorageMock({
        [K().CATEGORIES]: [{ id: 'c02', name: '02 資訊科學', parentId: null }],
        [K().TAGS]: ids.slice(0, 4).map(id => ({ id, name: id, categoryId: 'old' }))
        // t5 不存在
      })
      const result = await TagStorageAdapter.batchMoveTags(ids, 'c02')
      expect(result.moved).toBe(4)
      expect(result.failed).toBe(1)
    })
  })

  describe('F-batchDel: batchDeleteTags 回報 deleted/failed', () => {
    it('含不存在 tag 時回報 deleted/failed 計數', async () => {
      setupChromeStorageMock({
        [K().TAGS]: [
          { id: 't1', name: 't1', categoryId: 'c' },
          { id: 't2', name: 't2', categoryId: 'c' }
        ]
      })
      const result = await TagStorageAdapter.batchDeleteTags(['t1', 't2', 'ghost'])
      expect(result.deleted).toBe(2)
      expect(result.failed).toBe(1)
    })
  })

  describe('F-move-depth: moveTagCategory 子樹超深被拒（Q2）', () => {
    it('move 後子樹超 MAX_DEPTH → max_depth_exceeded，不部分移動', async () => {
      setupChromeStorageMock({
        [K().CATEGORIES]: [
          // 目標 parent 已 depth=2；移動的子樹自身高度 2 → 移動後達 depth=4
          { id: 'tgt0', name: 'tgt0', parentId: null },
          { id: 'tgt1', name: 'tgt1', parentId: 'tgt0' },
          { id: 'tgt2', name: 'tgt2', parentId: 'tgt1' },
          { id: 'src', name: 'src', parentId: null },
          { id: 'srcChild', name: 'srcChild', parentId: 'src' }
        ]
      })
      const result = await TagStorageAdapter.moveTagCategory('src', 'tgt2')
      expect(result.success).toBe(false)
      expect(result.error).toBe('max_depth_exceeded')
    })
  })
})
