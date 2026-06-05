/**
 * Tag 樹狀 model 同步與打包 integration（場景組 E）
 *
 * 涵蓋範圍（SPEC-010 §3 場景組 E + §4 Q5）：
 * - E1 預裝必須 storage.local（非 sync）
 * - E2-a 預裝本地重建不進 sync
 * - E2-b 用戶差異 LWW + tombstone / E2-b-tomb tombstone 傳播
 * - E2-c 預裝版本 flag 存 local
 * - E3 資料檔打包入 build.js COPY_PATHS
 * - E-upsert-merge 升級保守 merge 不覆蓋用戶改名
 *
 * TDD Phase 2（Red）：實作由 Phase 3 完成。對應 Ticket 0.20.0-W2-007。
 *
 * @jest-environment jsdom
 */

const fs = require('fs')
const path = require('path')
const TagStorageAdapter = require('src/storage/adapters/tag-storage-adapter')
const { setupChromeStorageMock } = require('./fixtures/tag-tree-fixture')

const K = () => TagStorageAdapter.STORAGE_KEYS

describe('Tag 樹狀同步與打包 integration（場景組 E）', () => {
  afterEach(() => { delete global.chrome; jest.clearAllMocks() })

  describe('E1: 預裝必須 storage.local', () => {
    it('initializePresets 呼叫 storage.local.set，不呼叫 storage.sync.set', async () => {
      setupChromeStorageMock({ [K().CATEGORIES]: [] })
      await TagStorageAdapter.initializePresets()
      expect(global.chrome.storage.local.set).toHaveBeenCalled()
      expect(global.chrome.storage.sync.set).not.toHaveBeenCalled()
    })
  })

  describe('E2-b: 用戶差異 LWW + tombstone', () => {
    it('自建 category 兩裝置衝突，較新 updatedAt 勝（LWW）', () => {
      const localCategories = [
        { id: 'u1', name: '我的分類', parentId: null, updatedAt: '2026-06-01T00:00:00Z' }
      ]
      const incomingCategories = [
        { id: 'u1', name: '我的分類-改', parentId: null, updatedAt: '2026-06-05T00:00:00Z' }
      ]
      const result = TagStorageAdapter.computeMergeResult({
        localCategories, incomingCategories, localTags: [], incomingTags: []
      })
      const merged = (result.categories || result.mergedCategories || []).find(c => c.id === 'u1')
      expect(merged.name).toBe('我的分類-改') // 較新 updatedAt 勝
    })

    it('E2-b-tomb: tombstone 刪除標記傳播，刪除項不復活', () => {
      const localCategories = [
        { id: 'u1', name: '我的分類', parentId: null, updatedAt: '2026-06-01T00:00:00Z' }
      ]
      const incomingCategories = [
        { id: 'u1', deleted: true, updatedAt: '2026-06-05T00:00:00Z' }
      ]
      const result = TagStorageAdapter.computeMergeResult({
        localCategories, incomingCategories, localTags: [], incomingTags: []
      })
      const merged = (result.categories || result.mergedCategories || [])
      expect(merged.find(c => c.id === 'u1' && !c.deleted)).toBeUndefined()
    })
  })

  describe('E3: 資料檔打包入 COPY_PATHS', () => {
    it('build.js COPY_PATHS 含 chinese-classification.json（bundle 決策）', () => {
      const buildPath = path.resolve(__dirname, '../../build.js')
      const content = fs.readFileSync(buildPath, 'utf-8')
      expect(content).toMatch(/chinese-classification\.json/)
    })
  })

  describe('E-upsert-merge: 升級保守 merge 不覆蓋用戶改名（Q5）', () => {
    it('用戶改了預裝節點 name，新版 upsert 不覆蓋既存 name', async () => {
      const ctx = setupChromeStorageMock({
        [K().CATEGORIES]: [
          { id: 'sys_cat_0', name: '我改的總類', parentId: null, isSystem: true }
        ]
      })
      await TagStorageAdapter.initializePresets()
      const cat = ctx.store[K().CATEGORIES].find(c => c.id === 'sys_cat_0')
      expect(cat.name).toBe('我改的總類') // 保守 merge：不覆蓋用戶改名
    })
  })
})
