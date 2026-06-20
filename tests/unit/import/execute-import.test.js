/**
 * Phase 2 測試群組 C：executeImport（BU-4 + BU-5 + BU-6）
 *
 * Ticket: 1.2.0-W1-002
 * 功能職責：完整匯入流程 + 來源分流 + 合併摘要 + last_imported_at
 * 跨群組依賴：mergeAllData（Mock）、chrome.storage.local（Mock）
 *
 * mergeAllData mock 策略：以有狀態 storage 模擬真實合併效果——
 * mock 將傳入 books 依 id LWW 併入 storage 的 readmoo_books，
 * 使 executeImport 的「後快照」反映合併結果，摘要計算得以驗證。
 */

const bookAdapter = require('src/export/book-interchange-v1-adapter')
const v1v2 = require('src/export/v1-to-v2-converter')
const tagStorage = require('src/storage/adapters/tag-storage-adapter')

const { executeImport } = require('src/import/json-importer')
const { createCanonicalJSON, createV2JSON, createV1JSON, createAppLegacyJSON } = require('@tests/unit/import/fixtures')

// 有狀態 storage：以記憶體 store 取代 test-setup 的固定 null 回傳
let store

function installStatefulStorage () {
  store = {}
  chrome.storage.local.get.mockImplementation((keys, callback) => {
    const result = {}
    const keyList = Array.isArray(keys) ? keys : [keys]
    keyList.forEach(key => { result[key] = key in store ? store[key] : null })
    callback(result)
  })
  chrome.storage.local.set.mockImplementation((items, callback) => {
    Object.assign(store, items)
    if (callback) callback()
  })
}

function seedLocalBooks (books) {
  store.readmoo_books = books
}

function setLastImportedAt (value) {
  store.last_imported_at = value
}

beforeEach(() => {
  installStatefulStorage()
  // 預設 mergeAllData：id LWW 併入 store.readmoo_books，回傳成功
  jest.spyOn(tagStorage, 'mergeAllData').mockImplementation(async ({ books }) => {
    const current = Array.isArray(store.readmoo_books) ? store.readmoo_books : []
    const byId = new Map(current.map(b => [b.id, b]))
    for (const incoming of books) {
      byId.set(incoming.id, incoming)
    }
    store.readmoo_books = Array.from(byId.values())
    return { success: true, counts: { books: store.readmoo_books.length, tags: 0, tagCategories: 0 } }
  })
})

afterEach(() => {
  jest.restoreAllMocks()
})

describe('executeImport（測試群組 C）', () => {
  describe('A3：來源分流', () => {
    test('A3-1：正常匯入 canonical（完整流程）→ success、added 3、mapCanonicalToV1Book 3 次、merge 1 次、last_imported_at 寫入', async () => {
      const mapSpy = jest.spyOn(bookAdapter, 'mapCanonicalToV1Book')
      const fileContent = createCanonicalJSON({ bookCount: 3, exportedAt: null })

      const result = await executeImport(fileContent)

      expect(result.success).toBe(true)
      expect(result.summary.added).toBe(3)
      expect(mapSpy).toHaveBeenCalledTimes(3)
      expect(tagStorage.mergeAllData).toHaveBeenCalledTimes(1)
      expect(store.last_imported_at).toBeDefined()
    })

    test('A3-2：匯入 app-legacy → convertAppLegacyToV2Data 被呼叫', async () => {
      const convSpy = jest.spyOn(v1v2, 'convertAppLegacyToV2Data')
      const fileContent = createAppLegacyJSON({ bookCount: 2 })

      const result = await executeImport(fileContent)

      expect(result.success).toBe(true)
      expect(convSpy).toHaveBeenCalled()
    })

    test('A3-3：匯入 v2 → books 直接傳給 mergeAllData', async () => {
      const fileContent = createV2JSON({ bookCount: 1 })

      const result = await executeImport(fileContent)

      expect(result.success).toBe(true)
      const passed = tagStorage.mergeAllData.mock.calls[0][0]
      expect(passed.books).toHaveLength(1)
    })

    test('A3-4：匯入 v1 → books 直接傳給 mergeAllData', async () => {
      const fileContent = createV1JSON({ bookCount: 2 })

      const result = await executeImport(fileContent)

      expect(result.success).toBe(true)
      const passed = tagStorage.mergeAllData.mock.calls[0][0]
      expect(passed.books).toHaveLength(2)
    })
  })

  describe('防舊蓋新與 skip', () => {
    test('A3-5：skipStalenessCheck 繼續匯入 → success', async () => {
      setLastImportedAt('2026-06-20T10:00:00Z')
      const fileContent = createCanonicalJSON({ bookCount: 1, exportedAt: '2026-06-19T00:00:00Z' })

      const result = await executeImport(fileContent, { skipStalenessCheck: true })

      expect(result.success).toBe(true)
    })

    test('E2-1b：防舊蓋新攔截 → success false、IMPORT_STALE_DATA、不呼叫 mergeAllData', async () => {
      setLastImportedAt('2026-06-20T10:00:00Z')
      const fileContent = createCanonicalJSON({ bookCount: 1, exportedAt: '2026-06-19T00:00:00Z' })

      const result = await executeImport(fileContent)

      expect(result.success).toBe(false)
      expect(result.error.code).toBe('IMPORT_STALE_DATA')
      expect(tagStorage.mergeAllData).not.toHaveBeenCalled()
    })
  })

  describe('儲存失敗', () => {
    test('E3-1：mergeAllData 失敗 → success false、IMPORT_STORAGE_ERROR、不更新 last_imported_at', async () => {
      tagStorage.mergeAllData.mockResolvedValueOnce({ success: false, error: 'storage_error' })
      const fileContent = createCanonicalJSON({ bookCount: 1, exportedAt: null })

      const result = await executeImport(fileContent)

      expect(result.success).toBe(false)
      expect(result.error.code).toBe('IMPORT_STORAGE_ERROR')
      expect(store.last_imported_at).toBeUndefined()
    })
  })

  describe('C3：合併摘要計算', () => {
    test('C3-1：全新增 → added N、updated 0、unchanged 0', async () => {
      seedLocalBooks([])
      const fileContent = createCanonicalJSON({ bookCount: 3, exportedAt: null })

      const result = await executeImport(fileContent)

      expect(result.summary.added).toBe(3)
      expect(result.summary.updated).toBe(0)
      expect(result.summary.unchanged).toBe(0)
    })

    test('C3-2：混合（本機 A 舊/B；匯入 A 新/C）→ added 1、updated 1、unchanged 1', async () => {
      seedLocalBooks([
        { id: 'mix-A', title: 'A', updatedAt: '2026-06-18T00:00:00Z' },
        { id: 'mix-B', title: 'B', updatedAt: '2026-06-20T00:00:00Z' }
      ])
      const fileContent = JSON.stringify({
        format: 'book-interchange-v1',
        metadata: {},
        books: [
          { id: 'mix-A', title: 'A', updatedAt: '2026-06-20T00:00:00Z', tags: {} },
          { id: 'mix-C', title: 'C', updatedAt: '2026-06-20T00:00:00Z', tags: {} }
        ]
      })

      const result = await executeImport(fileContent)

      expect(result.summary.added).toBe(1)
      expect(result.summary.updated).toBe(1)
      expect(result.summary.unchanged).toBe(1)
    })

    test('C3-3：全不變（本機與匯入相同 id+updatedAt）→ added 0、updated 0、unchanged N', async () => {
      seedLocalBooks([{ id: 'same-1', title: 'S', updatedAt: '2026-06-20T00:00:00Z' }])
      const fileContent = JSON.stringify({
        format: 'book-interchange-v1',
        metadata: {},
        books: [{ id: 'same-1', title: 'S', updatedAt: '2026-06-20T00:00:00Z', tags: {} }]
      })

      const result = await executeImport(fileContent)

      expect(result.summary.added).toBe(0)
      expect(result.summary.updated).toBe(0)
      expect(result.summary.unchanged).toBe(1)
    })
  })

  describe('C3：last_imported_at 持久化', () => {
    test('C3-4：首次寫入 → chrome.storage.local 含 last_imported_at', async () => {
      const fileContent = createCanonicalJSON({ bookCount: 1, exportedAt: null })

      await executeImport(fileContent)

      expect(store.last_imported_at).toBeDefined()
    })

    test('C3-5：覆蓋舊值 → last_imported_at 更新為新值', async () => {
      setLastImportedAt('2026-06-18T00:00:00Z')
      const fileContent = createCanonicalJSON({ bookCount: 1, exportedAt: null })

      await executeImport(fileContent)

      expect(store.last_imported_at).not.toBe('2026-06-18T00:00:00Z')
    })
  })
})
