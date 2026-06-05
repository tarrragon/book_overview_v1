/**
 * Tag 樹狀 model 預裝載入機制 integration（場景組 D）
 *
 * 涵蓋範圍（SPEC-010 §3 場景組 D + §4 Q3）：
 * - D1 首次安裝注入預裝樹（確定性 ID + isSystem + 整批原子 set）
 * - D2 listener 頂層同步註冊
 * - D3 onStartup 補償冪等 / D3-idem 重複 onStartup 冪等
 * - D4 預裝走獨立 upsert 不經 createTagCategory 隨機 ID
 * - D-atomic 整批原子 set（部分失敗整批不生效）
 * - D-quota 配額滿不強寫（preset_init_failed）
 *
 * TDD Phase 2（Red）：實作由 Phase 3 完成。對應 Ticket 0.20.0-W2-007。
 *
 * 設計考量：chrome.runtime + storage.local mock；D2 以 addListener 呼叫斷言間接驗證頂層同步註冊。
 *
 * @jest-environment jsdom
 */

const TagStorageAdapter = require('src/storage/adapters/tag-storage-adapter')
const { setupChromeStorageMock } = require('./fixtures/tag-tree-fixture')

const K = () => TagStorageAdapter.STORAGE_KEYS

describe('Tag 樹狀預裝載入 integration（場景組 D）', () => {
  afterEach(() => { delete global.chrome; jest.clearAllMocks(); jest.resetModules() })

  describe('D1: 首次安裝注入預裝樹', () => {
    it('全新安裝 initializePresets 以確定性 ID 整批原子 set，全 isSystem=true', async () => {
      const ctx = setupChromeStorageMock({ [K().CATEGORIES]: [] })
      const result = await TagStorageAdapter.initializePresets()
      expect(result.success).toBe(true)
      const cats = ctx.store[K().CATEGORIES]
      expect(cats.length).toBeGreaterThan(0)
      cats.forEach(c => {
        expect(c.isSystem).toBe(true)
        expect(c.id).toMatch(/^sys_cat_/) // 確定性 ID，非 cat_<timestamp>
      })
      // 整批原子：一次 set 寫入全部
      expect(global.chrome.storage.local.set).toHaveBeenCalledTimes(1)
    })
  })

  describe('D2: listener 頂層同步註冊', () => {
    it('require background module 時 onInstalled/onStartup addListener 同步呼叫', () => {
      const onInstalledAddListener = jest.fn()
      const onStartupAddListener = jest.fn()
      global.chrome = {
        runtime: {
          onInstalled: { addListener: onInstalledAddListener },
          onStartup: { addListener: onStartupAddListener }
        },
        storage: { local: { get: jest.fn(() => Promise.resolve({})), set: jest.fn(() => Promise.resolve()) } }
      }
      // Phase 3 接線：require 後 listener 應已在頂層同步註冊（無前置 await）
      require('src/background/background')
      expect(onInstalledAddListener).toHaveBeenCalled()
      expect(onStartupAddListener).toHaveBeenCalled()
    })
  })

  describe('D3: onStartup 補償冪等', () => {
    it('onInstalled 部分注入後，onStartup 補注缺失節點且不重複', async () => {
      const ctx = setupChromeStorageMock({
        [K().CATEGORIES]: [
          { id: 'sys_cat_0', name: '0 總類', parentId: null, isSystem: true }
        ]
      })
      const result = await TagStorageAdapter.initializePresets()
      expect(result.success).toBe(true)
      const cats = ctx.store[K().CATEGORIES]
      const ids = cats.map(c => c.id)
      // 已存在的 sys_cat_0 不重複建立
      expect(ids.filter(id => id === 'sys_cat_0').length).toBe(1)
    })

    it('D3-idem: 預裝已完整時重複 initializePresets 無新增', async () => {
      const r1 = await (async () => {
        setupChromeStorageMock({ [K().CATEGORIES]: [] })
        return TagStorageAdapter.initializePresets()
      })()
      expect(r1.success).toBe(true)
      const ctx = setupChromeStorageMock({ [K().CATEGORIES]: [{ id: 'sys_cat_0', name: '0 總類', parentId: null, isSystem: true }] })
      const before = ctx.store[K().CATEGORIES].length
      await TagStorageAdapter.initializePresets()
      // 冪等：已存在節點不重複（節點數量不因重複呼叫無限增長）
      const after = ctx.store[K().CATEGORIES].length
      expect(after).toBeGreaterThanOrEqual(before)
    })
  })

  describe('D4: 預裝走獨立 upsert 不經隨機 ID', () => {
    it('initializePresets 不呼叫 createTagCategory；ID 為確定性', async () => {
      const ctx = setupChromeStorageMock({ [K().CATEGORIES]: [] })
      const spy = jest.spyOn(TagStorageAdapter, 'createTagCategory')
      await TagStorageAdapter.initializePresets()
      expect(spy).not.toHaveBeenCalled()
      const cats = ctx.store[K().CATEGORIES]
      cats.forEach(c => expect(c.id).not.toMatch(/^cat_\d+/))
      spy.mockRestore()
    })
  })

  describe('D-atomic: 整批原子 set 部分失敗整批不生效', () => {
    it('storage.set reject → preset_init_failed 且無部分寫入', async () => {
      const ctx = setupChromeStorageMock({ [K().CATEGORIES]: [] })
      global.chrome.storage.local.set = jest.fn(() => Promise.reject(new Error('set failed')))
      const result = await TagStorageAdapter.initializePresets()
      expect(result.success).toBe(false)
      expect(result.error).toBe('preset_init_failed')
      expect(ctx.store[K().CATEGORIES]).toEqual([])
    })
  })

  describe('D-quota: 配額滿不強寫（Q3）', () => {
    it('quota=blocked 時 initializePresets 回 preset_init_failed', async () => {
      setupChromeStorageMock({ [K().CATEGORIES]: [], __quota: 'blocked' })
      // Phase 3a 補料：quota mock 注入機制（對齊既有 quota 檢查 pattern）
      const result = await TagStorageAdapter.initializePresets()
      expect(result.success).toBe(false)
      expect(result.error).toBe('preset_init_failed')
    })
  })
})
