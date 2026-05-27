/**
 * 跨裝置 JSON 匯出入 round-trip 整合測試（UC-05）
 *
 * Ticket: 0.19.0-W1-003.1
 *
 * 測試情境：
 *   裝置 A（含 10 本書 / 5 tag / 2 category / 6 種閱讀狀態）
 *     -> BookDataExporter 匯出 Interchange Format v2 JSON
 *     -> 模擬雲端傳輸（純字串往返 + JSON.parse/stringify）
 *     -> 裝置 B（不同 chrome.storage instance、不同 profile 起點）
 *     -> ContentParser 解析 + TagStorageAdapter.replaceAllData/mergeAllData
 *     -> 驗證 B 端 storage 與 A 端來源完全一致（覆蓋模式）/ 符合合併規則（合併模式）
 *
 * Acceptance：
 *   AC-1 裝置 A 至 B 覆蓋模式匯入後書籍總數一致（誤差 = 0）
 *   AC-2 tag 與 tagCategories 在 B 完整呈現（覆蓋模式為純複製）
 *   AC-3 6 種閱讀狀態完整保留（unread/reading/finished/queued/abandoned/reference）
 *   AC-4 v2 格式偵測成功（不需手動指定格式）
 *
 * 規格依據：docs/spec/export-interchange-format-v2.md §3 schema / §8.1 覆蓋 / §8.2 合併
 *
 * 設計考量（test-assertion-design 規則）：
 *   - 無計時硬門檻（純功能正確性驗證）
 *   - chrome.storage mock 為兩個獨立 store 物件以模擬「不同裝置」
 *   - 每個測試案例為純資料 round-trip，不依賴 DOM 或 UI 元件
 *
 * @jest-environment jsdom
 */

const fs = require('fs')
const path = require('path')

const BookDataExporter = require('src/export/book-data-exporter')
const { ContentParser } = require('src/overview/import/content-parser')
const TagStorageAdapter = require('src/storage/adapters/tag-storage-adapter')

const STORAGE_KEYS = TagStorageAdapter.STORAGE_KEYS

// ===========================================================================
// 共用工具：chrome.storage.local mock 工廠（每個「裝置」獨立 store）
// ===========================================================================

/**
 * 設定 chrome.storage.local mock 為指定的 store，每次呼叫切換「裝置」上下文。
 * BookDataExporter / TagStorageAdapter 依賴 global chrome.storage.local；
 * 透過切換 mock implementation 模擬兩個獨立裝置的 storage。
 *
 * @param {Object} store - 該裝置的 storage 物件（測試直接讀寫斷言）
 * @param {Object} [options]
 * @param {number} [options.bytesInUse] - 固定 getBytesInUse 值
 */
function bindStorageMock (store, options = {}) {
  delete chrome.runtime.lastError

  chrome.storage.local.get.mockImplementation((keys, callback) => {
    const result = {}
    const keyList = Array.isArray(keys) ? keys : [keys]
    keyList.forEach((key) => {
      result[key] = store[key] !== undefined
        ? JSON.parse(JSON.stringify(store[key]))
        : undefined
    })
    callback(result)
  })

  chrome.storage.local.set.mockImplementation((items, callback) => {
    Object.keys(items).forEach((key) => {
      store[key] = JSON.parse(JSON.stringify(items[key]))
    })
    if (callback) callback()
  })

  chrome.storage.local.getBytesInUse.mockImplementation((keys, callback) => {
    if (typeof options.bytesInUse === 'number') {
      callback(options.bytesInUse)
      return
    }
    callback(JSON.stringify(store).length)
  })
}

/**
 * 載入裝置 A 完整書庫 fixture。
 * @returns {{ books, tags, tagCategories }} v2 三區段
 */
function loadDeviceAFixture () {
  const raw = fs.readFileSync(
    path.join(__dirname, 'fixtures', 'device-a-library.json'),
    'utf8'
  )
  const data = JSON.parse(raw)
  return {
    books: data.books,
    tags: data.tags,
    tagCategories: data.tagCategories
  }
}

/**
 * 載入裝置 B 既有書庫 fixture（合併模式測試用，含 1 本與 A 同 id 書籍）。
 * @returns {{ books, tags, tagCategories }} v2 三區段
 */
function loadDeviceBExistingFixture () {
  const raw = fs.readFileSync(
    path.join(__dirname, 'fixtures', 'device-b-existing.json'),
    'utf8'
  )
  const data = JSON.parse(raw)
  return {
    books: data.books,
    tags: data.tags,
    tagCategories: data.tagCategories
  }
}

/**
 * 預置裝置 A 的 storage（直接寫入 store 物件，繞過 quota 與 lock）。
 * @param {Object} store - bindStorageMock 綁定的 store
 * @param {Object} data - { books, tags, tagCategories }
 */
function preloadDeviceStorage (store, { books, tags, tagCategories }) {
  store[STORAGE_KEYS.READMOO_BOOKS] = JSON.parse(JSON.stringify(books))
  store[STORAGE_KEYS.TAGS] = JSON.parse(JSON.stringify(tags))
  store[STORAGE_KEYS.TAG_CATEGORIES] = JSON.parse(JSON.stringify(tagCategories))
}

/**
 * 由裝置 A 的書籍 + tags + categories 匯出 v2 JSON 字串（COMPLETE_V2 preset）。
 * 模擬 overview「匯出 JSON」按鈕的產出。
 *
 * @param {Object} data - { books, tags, tagCategories }
 * @returns {string} v2 JSON 字串
 */
function exportToV2Json ({ books, tags, tagCategories }) {
  const exporter = new BookDataExporter(books)
  return exporter.exportToJSON({
    formatVersion: '2.0.0',
    fieldPreset: 'COMPLETE_V2',
    tags,
    tagCategories,
    pretty: false
  })
}

/**
 * 模擬雲端傳輸：純字串 round-trip（壓縮 + 解壓 + 序列化保持型別）。
 * @param {string} jsonString
 * @returns {string} 經過 parse + stringify 後的等價 JSON 字串
 */
function simulateCloudTransport (jsonString) {
  // 1. 模擬「傳輸前」字串檢視（檔案存入雲端）
  expect(typeof jsonString).toBe('string')
  expect(jsonString.length).toBeGreaterThan(0)
  // 2. 模擬「下載端」重新解析（檔案從雲端取出）
  const parsed = JSON.parse(jsonString)
  // 3. 模擬「下載端再寫回字串」（如 IndexedDB 緩存階段）
  return JSON.stringify(parsed)
}

/**
 * 裝置 B 將下載到的 JSON 字串透過 ContentParser 解析為 ImportResult。
 * @param {string} jsonString
 * @returns {{ books, tags, tagCategories }}
 */
function parseImportContent (jsonString) {
  const parser = new ContentParser()
  return parser.parse(jsonString, 'json')
}

/**
 * 從 store 讀回 readmoo_books 的 books 陣列（處理 wrapper 結構）。
 * @param {Object} store
 * @returns {Array}
 */
function readStoreBooks (store) {
  const raw = store[STORAGE_KEYS.READMOO_BOOKS]
  if (!raw) return []
  if (Array.isArray(raw)) return raw
  if (raw.books && Array.isArray(raw.books)) return raw.books
  return []
}

// ===========================================================================

describe('跨裝置 JSON round-trip — UC-05（0.19.0-W1-003.1）', () => {
  let deviceAStore
  let deviceBStore

  beforeEach(() => {
    deviceAStore = {}
    deviceBStore = {}
  })

  afterEach(() => {
    if (chrome && chrome.storage && chrome.storage.local) {
      chrome.storage.local.get.mockReset()
      chrome.storage.local.set.mockReset()
      chrome.storage.local.getBytesInUse.mockReset()
    }
  })

  // ==========================================================================
  // Group A：覆蓋模式 round-trip（B 為 clean profile）
  //   對應 AC-1 / AC-2 / AC-3 / AC-4
  // ==========================================================================
  describe('Group A：覆蓋模式 round-trip（B 為 clean profile）', () => {
    test('TC-A1 [AC-1/AC-2] B 端書籍 / tag / category 數量與 A 端一致', async () => {
      // === Step 1：裝置 A 預置完整書庫 ===
      const aData = loadDeviceAFixture()
      bindStorageMock(deviceAStore)
      preloadDeviceStorage(deviceAStore, aData)

      // === Step 2：裝置 A 匯出 v2 JSON ===
      const exportedJson = exportToV2Json(aData)

      // === Step 3：模擬雲端傳輸 ===
      const downloadedJson = simulateCloudTransport(exportedJson)

      // === Step 4：裝置 B clean profile + 匯入（覆蓋模式）===
      bindStorageMock(deviceBStore)
      // B 為新裝置，storage 完全為空（不預置任何資料）
      const imported = parseImportContent(downloadedJson)
      const writeResult = await TagStorageAdapter.replaceAllData({
        books: imported.books,
        tags: imported.tags,
        tagCategories: imported.tagCategories
      })

      // === Step 5：驗證 ===
      expect(writeResult.success).toBe(true)

      const bBooks = readStoreBooks(deviceBStore)
      // AC-1：書籍總數一致（誤差 = 0）
      expect(bBooks).toHaveLength(aData.books.length)
      // AC-2：tag 數量 + tagCategories 數量一致
      expect(deviceBStore[STORAGE_KEYS.TAGS]).toHaveLength(aData.tags.length)
      expect(deviceBStore[STORAGE_KEYS.TAG_CATEGORIES]).toHaveLength(
        aData.tagCategories.length
      )
      // writeResult 統計值與 fixture 一致（內部 counts SSOT）
      expect(writeResult.counts).toEqual({
        books: aData.books.length,
        tags: aData.tags.length,
        tagCategories: aData.tagCategories.length
      })
    })

    test('TC-A2 [AC-2] tag id / name / categoryId 完整保留（聯集前的純複製）', async () => {
      const aData = loadDeviceAFixture()
      bindStorageMock(deviceAStore)
      preloadDeviceStorage(deviceAStore, aData)

      const exportedJson = exportToV2Json(aData)
      const downloadedJson = simulateCloudTransport(exportedJson)

      bindStorageMock(deviceBStore)
      const imported = parseImportContent(downloadedJson)
      await TagStorageAdapter.replaceAllData({
        books: imported.books,
        tags: imported.tags,
        tagCategories: imported.tagCategories
      })

      // 比對 B 端的 tags 與 A 端 fixture 逐項對齊（id / name / categoryId）
      const aTagsById = new Map(aData.tags.map((t) => [t.id, t]))
      const bTags = deviceBStore[STORAGE_KEYS.TAGS]
      bTags.forEach((bt) => {
        const at = aTagsById.get(bt.id)
        expect(at).toBeDefined()
        expect(bt.name).toBe(at.name)
        expect(bt.categoryId).toBe(at.categoryId)
      })

      // 比對 B 端的 tagCategories 與 A 端對齊
      const aCatsById = new Map(aData.tagCategories.map((c) => [c.id, c]))
      const bCats = deviceBStore[STORAGE_KEYS.TAG_CATEGORIES]
      bCats.forEach((bc) => {
        const ac = aCatsById.get(bc.id)
        expect(ac).toBeDefined()
        expect(bc.name).toBe(ac.name)
      })

      // 對 A 中每本書的 tagIds，B 端必能 resolve 為合法 tag（refential integrity）
      const bTagIds = new Set(bTags.map((t) => t.id))
      aData.books.forEach((book) => {
        book.tagIds.forEach((tagId) => {
          expect(bTagIds.has(tagId)).toBe(true)
        })
      })
    })

    test('TC-A3 [AC-3] 6 種閱讀狀態完整保留（含 v1.1 新增的 queued/abandoned/reference）', async () => {
      const aData = loadDeviceAFixture()
      bindStorageMock(deviceAStore)
      preloadDeviceStorage(deviceAStore, aData)

      // 確認 fixture 涵蓋 6 種閱讀狀態（前置條件斷言）
      const aStatusSet = new Set(aData.books.map((b) => b.readingStatus))
      expect(aStatusSet).toEqual(
        new Set(['unread', 'reading', 'finished', 'queued', 'abandoned', 'reference'])
      )

      const exportedJson = exportToV2Json(aData)
      const downloadedJson = simulateCloudTransport(exportedJson)

      bindStorageMock(deviceBStore)
      const imported = parseImportContent(downloadedJson)
      await TagStorageAdapter.replaceAllData({
        books: imported.books,
        tags: imported.tags,
        tagCategories: imported.tagCategories
      })

      // B 端必須完整保留所有 6 種狀態
      const bBooks = readStoreBooks(deviceBStore)
      const bStatusSet = new Set(bBooks.map((b) => b.readingStatus))
      expect(bStatusSet).toEqual(aStatusSet)

      // 每本書的 readingStatus 與 A 端對齊（id 對照）
      const aById = new Map(aData.books.map((b) => [b.id, b]))
      bBooks.forEach((bb) => {
        const ab = aById.get(bb.id)
        expect(ab).toBeDefined()
        expect(bb.readingStatus).toBe(ab.readingStatus)
      })
    })

    test('TC-A4 [AC-3] isManualStatus 對手動狀態書籍正確保留', async () => {
      const aData = loadDeviceAFixture()
      bindStorageMock(deviceAStore)
      preloadDeviceStorage(deviceAStore, aData)

      const exportedJson = exportToV2Json(aData)
      const downloadedJson = simulateCloudTransport(exportedJson)

      bindStorageMock(deviceBStore)
      const imported = parseImportContent(downloadedJson)
      await TagStorageAdapter.replaceAllData({
        books: imported.books,
        tags: imported.tags,
        tagCategories: imported.tagCategories
      })

      const aById = new Map(aData.books.map((b) => [b.id, b]))
      const bBooks = readStoreBooks(deviceBStore)
      bBooks.forEach((bb) => {
        const ab = aById.get(bb.id)
        // isManualStatus 必須與來源完全一致（手動狀態 = true / 自動狀態 = false）
        expect(bb.isManualStatus).toBe(ab.isManualStatus)
      })

      // 進一步驗證：所有 queued/abandoned/reference 書籍 isManualStatus 皆為 true
      const manualOnlyBooks = bBooks.filter((b) =>
        ['queued', 'abandoned', 'reference'].includes(b.readingStatus)
      )
      manualOnlyBooks.forEach((b) => {
        expect(b.isManualStatus).toBe(true)
      })
    })

    test('TC-A5 [AC-4] v2 格式自動偵測（ContentParser 不需手動指定 v1/v2）', async () => {
      const aData = loadDeviceAFixture()
      const exportedJson = exportToV2Json(aData)
      const downloadedJson = simulateCloudTransport(exportedJson)

      // ContentParser.parse 只給 fileFormat='json'，未告知版本
      // 內部 detectFormatVersion 應自動辨識 metadata.formatVersion='2.0.0'
      const imported = parseImportContent(downloadedJson)

      // 應成功回傳 ImportResult 三欄位（INV-1）
      expect(Array.isArray(imported.books)).toBe(true)
      expect(Array.isArray(imported.tags)).toBe(true)
      expect(Array.isArray(imported.tagCategories)).toBe(true)
      // 內容應與來源對齊（自動偵測成功的證據）
      expect(imported.books).toHaveLength(aData.books.length)
      expect(imported.tags).toHaveLength(aData.tags.length)
      expect(imported.tagCategories).toHaveLength(aData.tagCategories.length)
    })

    test('TC-A6 [AC-1] tagIds 在 round-trip 後對所有書籍逐本對齊', async () => {
      const aData = loadDeviceAFixture()
      bindStorageMock(deviceAStore)
      preloadDeviceStorage(deviceAStore, aData)

      const exportedJson = exportToV2Json(aData)
      const downloadedJson = simulateCloudTransport(exportedJson)

      bindStorageMock(deviceBStore)
      const imported = parseImportContent(downloadedJson)
      await TagStorageAdapter.replaceAllData({
        books: imported.books,
        tags: imported.tags,
        tagCategories: imported.tagCategories
      })

      const aById = new Map(aData.books.map((b) => [b.id, b]))
      const bBooks = readStoreBooks(deviceBStore)
      bBooks.forEach((bb) => {
        const ab = aById.get(bb.id)
        // tagIds 是陣列，順序與內容皆與來源一致
        expect(bb.tagIds).toEqual(ab.tagIds)
      })

      // 額外驗證：有 tag 與無 tag 的書都正確處理
      const withTags = bBooks.filter((b) => b.tagIds.length > 0)
      const withoutTags = bBooks.filter((b) => b.tagIds.length === 0)
      expect(withTags.length).toBeGreaterThan(0)
      expect(withoutTags.length).toBeGreaterThan(0)
    })
  })

  // ==========================================================================
  // Group B：合併模式 round-trip（B 已有 3 本書 + 不同 tag）
  //   驗證 PCB 規格中「裝置 B 先有 5 本書再匯入」的衍生情境
  //   注意：本 group 不是 AC-1~AC-4 必要條件（覆蓋模式即達 AC），但 ticket how
  //   strategy step (5) 明示「重複測試合併模式」，故含入測試套件以覆蓋。
  // ==========================================================================
  describe('Group B：合併模式 round-trip（B 預存資料保留）', () => {
    test('TC-B1 同 id 書籍 tagIds 取聯集（合併語意）', async () => {
      // === Step 1：A 預置完整書庫並匯出 ===
      const aData = loadDeviceAFixture()
      bindStorageMock(deviceAStore)
      preloadDeviceStorage(deviceAStore, aData)
      const exportedJson = exportToV2Json(aData)
      const downloadedJson = simulateCloudTransport(exportedJson)

      // === Step 2：B 預置既有書庫 ===
      const bExisting = loadDeviceBExistingFixture()
      bindStorageMock(deviceBStore)
      preloadDeviceStorage(deviceBStore, bExisting)

      // === Step 3：B 合併匯入 ===
      const imported = parseImportContent(downloadedJson)
      const writeResult = await TagStorageAdapter.mergeAllData({
        books: imported.books,
        tags: imported.tags,
        tagCategories: imported.tagCategories
      })
      expect(writeResult.success).toBe(true)

      // === Step 4：驗證 ===
      const bBooksAfter = readStoreBooks(deviceBStore)

      // 同 id 書籍（rt-book-01）：tagIds 必須包含 B 原有 tag_b_note +
      // 從 A 匯入的 tag_sci_fi/tag_favorite（合併聯集語意，§8.2）
      const sharedBook = bBooksAfter.find((b) => b.id === 'rt-book-01')
      expect(sharedBook).toBeDefined()

      // tag_sci_fi / tag_favorite 經合併寫入後可能保留原 id 或被 remap 為新 id；
      // 透過 B 端 tags 表反查 name 來驗證（避開 id 重映射細節）
      const bTagsAfter = deviceBStore[STORAGE_KEYS.TAGS]
      const tagNameById = new Map(bTagsAfter.map((t) => [t.id, t.name]))
      const sharedBookTagNames = sharedBook.tagIds.map((id) => tagNameById.get(id))

      // 必含 B 原有的「已做筆記」
      expect(sharedBookTagNames).toContain('已做筆記')
      // 必含 A 匯入的「科幻」與「最愛」（聯集，未被覆蓋丟失）
      expect(sharedBookTagNames).toContain('科幻')
      expect(sharedBookTagNames).toContain('最愛')
    })

    test('TC-B2 B 端獨有書籍在合併後保留（永不刪除本地）', async () => {
      const aData = loadDeviceAFixture()
      const exportedJson = exportToV2Json(aData)
      const downloadedJson = simulateCloudTransport(exportedJson)

      const bExisting = loadDeviceBExistingFixture()
      bindStorageMock(deviceBStore)
      preloadDeviceStorage(deviceBStore, bExisting)

      const imported = parseImportContent(downloadedJson)
      await TagStorageAdapter.mergeAllData({
        books: imported.books,
        tags: imported.tags,
        tagCategories: imported.tagCategories
      })

      const bBooksAfter = readStoreBooks(deviceBStore)
      const bIdsAfter = new Set(bBooksAfter.map((b) => b.id))
      // B 獨有的 rt-b-only-01 / rt-b-only-02 必須保留
      expect(bIdsAfter.has('rt-b-only-01')).toBe(true)
      expect(bIdsAfter.has('rt-b-only-02')).toBe(true)

      // A 全部 10 本必須加入（含同 id 一本經更新後仍存在）
      aData.books.forEach((ab) => {
        expect(bIdsAfter.has(ab.id)).toBe(true)
      })

      // 合併後總書數 = A(10) + B 獨有(2) = 12（同 id 一本不重複計算）
      expect(bBooksAfter).toHaveLength(aData.books.length + 2)
    })

    test('TC-B3 合併後 6 種閱讀狀態與 isManualStatus 仍保留', async () => {
      const aData = loadDeviceAFixture()
      const exportedJson = exportToV2Json(aData)
      const downloadedJson = simulateCloudTransport(exportedJson)

      const bExisting = loadDeviceBExistingFixture()
      bindStorageMock(deviceBStore)
      preloadDeviceStorage(deviceBStore, bExisting)

      const imported = parseImportContent(downloadedJson)
      await TagStorageAdapter.mergeAllData({
        books: imported.books,
        tags: imported.tags,
        tagCategories: imported.tagCategories
      })

      const bBooksAfter = readStoreBooks(deviceBStore)

      // 合併語意（§8.2）：同 id 更新 → 同 id 書籍欄位以匯入端為準
      // 驗證：取自 A 的 readingStatus 對所有 A 中的書 id 都對齊
      const aById = new Map(aData.books.map((b) => [b.id, b]))
      bBooksAfter
        .filter((b) => aById.has(b.id))
        .forEach((bb) => {
          const ab = aById.get(bb.id)
          expect(bb.readingStatus).toBe(ab.readingStatus)
          expect(bb.isManualStatus).toBe(ab.isManualStatus)
        })

      // 6 種閱讀狀態（A 端涵蓋）必定在 B 端可見
      const bStatuses = new Set(bBooksAfter.map((b) => b.readingStatus))
      ;['unread', 'reading', 'finished', 'queued', 'abandoned', 'reference'].forEach(
        (status) => {
          expect(bStatuses.has(status)).toBe(true)
        }
      )
    })
  })

  // ==========================================================================
  // Group C：A/B 對比表（同 ticket acceptance #5 要求的摘要對比資料）
  //   提供 acceptance 章節寫入測試結果可引用的對照資料
  // ==========================================================================
  describe('Group C：A/B 端摘要對比', () => {
    test('TC-C1 [AC-1/AC-2/AC-3] 覆蓋模式 round-trip 後 A/B 摘要全面比對', async () => {
      const aData = loadDeviceAFixture()
      bindStorageMock(deviceAStore)
      preloadDeviceStorage(deviceAStore, aData)

      const exportedJson = exportToV2Json(aData)
      const downloadedJson = simulateCloudTransport(exportedJson)

      bindStorageMock(deviceBStore)
      const imported = parseImportContent(downloadedJson)
      await TagStorageAdapter.replaceAllData({
        books: imported.books,
        tags: imported.tags,
        tagCategories: imported.tagCategories
      })

      // 摘要對比（與 ticket Test Results 章節對齊）
      const aBooks = aData.books
      const bBooks = readStoreBooks(deviceBStore)

      const summary = {
        bookCount: { a: aBooks.length, b: bBooks.length },
        tagCount: {
          a: aData.tags.length,
          b: deviceBStore[STORAGE_KEYS.TAGS].length
        },
        categoryCount: {
          a: aData.tagCategories.length,
          b: deviceBStore[STORAGE_KEYS.TAG_CATEGORIES].length
        },
        statusDistribution: {
          a: countByField(aBooks, 'readingStatus'),
          b: countByField(bBooks, 'readingStatus')
        },
        manualStatusCount: {
          a: aBooks.filter((b) => b.isManualStatus).length,
          b: bBooks.filter((b) => b.isManualStatus).length
        }
      }

      // 每組摘要 A === B
      expect(summary.bookCount.a).toBe(summary.bookCount.b)
      expect(summary.tagCount.a).toBe(summary.tagCount.b)
      expect(summary.categoryCount.a).toBe(summary.categoryCount.b)
      expect(summary.statusDistribution.a).toEqual(summary.statusDistribution.b)
      expect(summary.manualStatusCount.a).toBe(summary.manualStatusCount.b)
    })
  })
})

// ===========================================================================
// 輔助：依欄位值計數（用於狀態分布對比）
// ===========================================================================

/**
 * @param {Array<Object>} items
 * @param {string} field
 * @returns {Object} { fieldValue: count }
 */
function countByField (items, field) {
  return items.reduce((acc, item) => {
    const key = item[field]
    acc[key] = (acc[key] || 0) + 1
    return acc
  }, {})
}
