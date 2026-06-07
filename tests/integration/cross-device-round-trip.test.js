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
 * 載入 v3 round-trip 用「含非標準欄位」書籍 fixture（多尺寸 cover / progressInfo /
 * 多 author / isbn），用以驗證 canonical 往返後 _passthrough 完整保留。
 * @returns {Array<Object>} 內部 v2 book model 陣列
 */
function loadV3PassthroughFixture () {
  const raw = fs.readFileSync(
    path.join(__dirname, 'fixtures', 'device-a-v3-passthrough.json'),
    'utf8'
  )
  return JSON.parse(raw).books
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
 * 由內部 v2 books 匯出 canonical（book-interchange-v1 v3）JSON 字串。
 * 模擬 overview「匯出 JSON（v3 canonical）」按鈕的產出（W4-001 接線）。
 *
 * v3 為 everything-as-tags：authors/source/publisher/isbn/tagIds/readingStatus
 * 全部映射為 tags 節點，root 含 format='book-interchange-v1' / formatVersion='3.0.0'
 * / books / tagTree（不需傳 tags/tagCategories 三區段，與 v2 不同）。
 *
 * @param {Array<Object>} books - 內部 v2 book model 陣列
 * @returns {string} v3 canonical JSON 字串
 */
function exportToV3Json (books) {
  const exporter = new BookDataExporter(books)
  return exporter.exportToJSON({
    formatVersion: '3.0.0',
    pretty: false
  })
}

/**
 * 斷言匯出字串確為 v3 canonical（book-interchange-v1）root（防 false positive）。
 *
 * 設計理由（PC-165）：v2 與 v3 對 id/title/authors/source/readingStatus/progress/tagIds
 * 的還原皆無損，若僅比對還原後欄位，core 測試在「export 誤走 v2」時仍會通過。
 * 每個 v3 round-trip 測試先過此守衛，確保斷言驗證的是 canonical 路徑而非泛 round-trip。
 *
 * @param {string} jsonString - 匯出的 JSON 字串
 * @returns {Object} 已解析的 canonical root（供 caller 進一步斷言）
 */
function assertCanonicalRoot (jsonString) {
  const root = JSON.parse(jsonString)
  expect(root.format).toBe('book-interchange-v1')
  expect(root.formatVersion).toBe('3.0.0')
  // everything-as-tags 證據：canonical book 以 tags 承載 author 等（非平鋪欄位）
  if (Array.isArray(root.books) && root.books.length > 0) {
    expect(root.books[0].tags).toBeDefined()
  }
  return root
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

  // ==========================================================================
  // Group D：v3 canonical（book-interchange-v1）端到端 round-trip
  //   對應 ticket 1.0.0-W4-002 acceptance：
  //     - export v3 → 序列化字串 → import 還原 整合鏈（acceptance 1）
  //     - round-trip 無損：everything-as-tags + _passthrough 保留（acceptance 2）
  //
  //   與 Group A/B/C（v2.0.0）的差異：
  //     - v3 為 everything-as-tags：authors/source/publisher/isbn/tagIds/readingStatus
  //       全部映射為 canonical tags 節點，匯出 root 為 book-interchange-v1 結構。
  //     - ContentParser 內部 detectInterchangeSource='canonical' → mapCanonicalToV1Book
  //       逐本還原為內部 v2 book model（無需手動指定格式）。
  //
  //   設計考量：
  //     - 純資料 round-trip，不經 chrome.storage（v3 匯出不讀三區段，免綁 storage mock）。
  //     - 無計時硬門檻（test-assertion-design 規則 1）。
  //     - 斷言對齊「實際無損契約」（PC-165）：逐本欄位 + tag 還原 + _passthrough 值比對，
  //       非僅檢查「import 未報錯」。
  // ==========================================================================
  describe('Group D：v3 canonical 端到端 round-trip（1.0.0-W4-002）', () => {
    test('TC-D1 [acceptance 1] export v3 → 序列化 → import 還原書籍數量一致', () => {
      // === Step 1：裝置 A 以 v3 canonical 匯出 ===
      const aBooks = loadDeviceAFixture().books
      const exportedJson = exportToV3Json(aBooks)

      // 匯出 root 應為 book-interchange-v1 canonical 結構（format/formatVersion 自描述）
      const exportedRoot = JSON.parse(exportedJson)
      expect(exportedRoot.format).toBe('book-interchange-v1')
      expect(exportedRoot.formatVersion).toBe('3.0.0')
      expect(Array.isArray(exportedRoot.books)).toBe(true)
      expect(exportedRoot.books).toHaveLength(aBooks.length)
      // everything-as-tags 證據：canonical book 以 tags 承載 author/platform 等（非平鋪欄位）
      expect(exportedRoot.books[0].tags).toBeDefined()

      // === Step 2：模擬雲端傳輸（純字串往返）===
      const downloadedJson = simulateCloudTransport(exportedJson)

      // === Step 3：裝置 B 匯入（ContentParser 自動路由 canonical，免指定格式）===
      const imported = parseImportContent(downloadedJson)

      // === Step 4：驗證還原書籍數量一致（誤差 = 0）===
      expect(Array.isArray(imported.books)).toBe(true)
      expect(imported.books).toHaveLength(aBooks.length)
    })

    test('TC-D2 [acceptance 1] canonical 來源自動偵測（ContentParser 不需手動指定格式）', () => {
      const aBooks = loadDeviceAFixture().books
      const exportedJson = exportToV3Json(aBooks)
      const downloadedJson = simulateCloudTransport(exportedJson)

      // ContentParser.parse 僅給 fileFormat='json'，未告知 v3；
      // 內部 detectInterchangeSource 應辨識 format='book-interchange-v1' → 'canonical'
      const imported = parseImportContent(downloadedJson)

      // 應成功回傳 ImportResult 三欄位（INV-1，恆為陣列）
      expect(Array.isArray(imported.books)).toBe(true)
      expect(Array.isArray(imported.tags)).toBe(true)
      expect(Array.isArray(imported.tagCategories)).toBe(true)
      // canonical 來源不產出 tag 三區段（tag 樹由 tagTree 重建屬後續範圍）
      expect(imported.tags).toHaveLength(0)
      expect(imported.tagCategories).toHaveLength(0)
    })

    test('TC-D3 [acceptance 2] everything-as-tags 逐本核心欄位無損還原', () => {
      const aBooks = loadDeviceAFixture().books
      const exportedJson = exportToV3Json(aBooks)
      assertCanonicalRoot(exportedJson) // 守衛：確為 v3 canonical 而非泛 round-trip
      const downloadedJson = simulateCloudTransport(exportedJson)
      const imported = parseImportContent(downloadedJson)

      const restoredById = new Map(imported.books.map((b) => [b.id, b]))
      aBooks.forEach((src) => {
        const restored = restoredById.get(src.id)
        // id 保留（C4 禁重生）
        expect(restored).toBeDefined()
        // title 無損
        expect(restored.title).toBe(src.title)
        // readingStatus 經 §7 雙向正規化往返後還原（六態各驗於 fixture）
        expect(restored.readingStatus).toBe(src.readingStatus)
        // progress（百分比）還原
        expect(restored.progress).toBe(src.progress)
        // source（platform tag 收斂回固定欄位）還原
        expect(restored.source).toBe(src.source)
        // publisher（publisher tag 收斂回固定欄位）還原
        expect(restored.publisher).toBe(src.publisher)
      })
    })

    test('TC-D4 [acceptance 2] authors（多值）經 canonical 往返後完整還原', () => {
      const aBooks = loadDeviceAFixture().books
      const exportedJson = exportToV3Json(aBooks)
      assertCanonicalRoot(exportedJson) // 守衛：確為 v3 canonical
      const downloadedJson = simulateCloudTransport(exportedJson)
      const imported = parseImportContent(downloadedJson)

      const restoredById = new Map(imported.books.map((b) => [b.id, b]))
      aBooks.forEach((src) => {
        const restored = restoredById.get(src.id)
        // author tag 多值不收斂；往返後 authors[] name 順序與內容完全一致
        expect(restored.authors).toEqual(src.authors)
      })

      // 顯式覆蓋多 author 案例（rt-book-06 有 2 位作者）與空 author 案例（rt-book-10）
      const multiAuthor = restoredById.get('rt-book-06')
      expect(multiAuthor.authors.length).toBeGreaterThanOrEqual(2)
      const emptyAuthor = restoredById.get('rt-book-10')
      expect(emptyAuthor.authors).toEqual([])
    })

    test('TC-D5 [acceptance 2] tagIds（custom tag 往返）逐本還原', () => {
      const aBooks = loadDeviceAFixture().books
      const exportedJson = exportToV3Json(aBooks)
      assertCanonicalRoot(exportedJson) // 守衛：確為 v3 canonical
      const downloadedJson = simulateCloudTransport(exportedJson)
      const imported = parseImportContent(downloadedJson)

      const restoredById = new Map(imported.books.map((b) => [b.id, b]))
      aBooks.forEach((src) => {
        const restored = restoredById.get(src.id)
        // tagIds → custom tag（id=name=tagId）→ tagIds 往返後 id 與順序一致
        expect(restored.tagIds).toEqual(src.tagIds)
      })

      // 有 tag / 無 tag 的書都正確處理（避免「全空也通過」假陽性）
      const withTags = imported.books.filter((b) => b.tagIds.length > 0)
      const withoutTags = imported.books.filter((b) => b.tagIds.length === 0)
      expect(withTags.length).toBeGreaterThan(0)
      expect(withoutTags.length).toBeGreaterThan(0)
    })

    test('TC-D6 [acceptance 2] 六種閱讀狀態經 v3 canonical 往返全保留', () => {
      const aBooks = loadDeviceAFixture().books

      // 前置條件：fixture 涵蓋六態（unread/reading/finished/queued/abandoned/reference）
      const srcStatuses = new Set(aBooks.map((b) => b.readingStatus))
      expect(srcStatuses).toEqual(
        new Set(['unread', 'reading', 'finished', 'queued', 'abandoned', 'reference'])
      )

      const exportedJson = exportToV3Json(aBooks)
      assertCanonicalRoot(exportedJson) // 守衛：確為 v3 canonical
      const downloadedJson = simulateCloudTransport(exportedJson)
      const imported = parseImportContent(downloadedJson)

      const restoredStatuses = new Set(imported.books.map((b) => b.readingStatus))
      expect(restoredStatuses).toEqual(srcStatuses)
    })

    test('TC-D7 [acceptance 2] _passthrough 保留（含非標準欄位的書往返後不丟失）', () => {
      // 放入含「多尺寸 cover + progressInfo + 多 author + isbn」的書，
      // 這些欄位經 mapCanonicalToV1Book 收斂後應存入 _passthrough（C1 禁丟失）。
      const ptBooks = loadV3PassthroughFixture()
      const exportedJson = exportToV3Json(ptBooks)
      const downloadedJson = simulateCloudTransport(exportedJson)
      const imported = parseImportContent(downloadedJson)

      expect(imported.books).toHaveLength(1)
      const restored = imported.books[0]
      const src = ptBooks[0]

      // 基礎欄位無損
      expect(restored.id).toBe(src.id)
      expect(restored.title).toBe(src.title)

      // _passthrough 存在且承載非標準資訊（rebuildFromPassthrough 路徑）
      expect(restored._passthrough).toBeDefined()
      expect(typeof restored._passthrough).toBe('object')

      // 多尺寸 cover：original 收斂回固定 cover，其餘尺寸入 _passthrough.cover（U19）
      expect(restored.cover).toBe(src.cover.original)
      expect(restored._passthrough.cover).toEqual({
        thumbnail: src.cover.thumbnail,
        medium: src.cover.medium
      })

      // progressInfo 多欄位：percentage 收斂回 progress，其餘入 progressInfo（U20）
      expect(restored.progress).toBe(src.progress)
      expect(restored.progressInfo).toEqual(src.progressInfo)

      // 多 author 的 tag 陣列（含 id）存入 _passthrough.tags.author（C1，U17）
      expect(restored.authors).toEqual(src.authors)
      expect(restored._passthrough.tags).toBeDefined()
      expect(Array.isArray(restored._passthrough.tags.author)).toBe(true)
      expect(restored._passthrough.tags.author.map((n) => n.name)).toEqual(src.authors)

      // isbn 收斂回 identifiers.isbn（單值不入 passthrough）
      expect(restored.identifiers.isbn).toBe(src.identifiers.isbn)
    })

    test('TC-D8 [acceptance 2] 二次 round-trip 穩定（export→import→export→import 冪等）', () => {
      // 驗證 round-trip 收斂後再次往返不再變動（無損的更強證據，避免單次往返恰好抵銷的假陽性）
      const aBooks = loadDeviceAFixture().books

      const firstJson = exportToV3Json(aBooks)
      assertCanonicalRoot(firstJson) // 守衛：首次匯出確為 v3 canonical
      const firstImport = parseImportContent(simulateCloudTransport(firstJson))

      const secondJson = exportToV3Json(firstImport.books)
      assertCanonicalRoot(secondJson) // 守衛：二次匯出（內部 v2 出發）仍為 v3 canonical
      const secondImport = parseImportContent(simulateCloudTransport(secondJson))

      // 兩次匯入結果逐本核心欄位完全一致（收斂後冪等）
      const firstById = new Map(firstImport.books.map((b) => [b.id, b]))
      secondImport.books.forEach((second) => {
        const first = firstById.get(second.id)
        expect(first).toBeDefined()
        expect(second.title).toBe(first.title)
        expect(second.authors).toEqual(first.authors)
        expect(second.source).toBe(first.source)
        expect(second.publisher).toBe(first.publisher)
        expect(second.readingStatus).toBe(first.readingStatus)
        expect(second.progress).toBe(first.progress)
        expect(second.tagIds).toEqual(first.tagIds)
      })
      expect(secondImport.books).toHaveLength(firstImport.books.length)
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
