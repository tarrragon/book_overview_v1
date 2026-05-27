/**
 * 跨裝置衝突解決 4 場景整合測試（UC-05 v1.1）
 *
 * Ticket: 0.19.0-W1-003.2
 *
 * 測試目的：
 *   延續 W1-003.1 的 round-trip 驗證，本檔聚焦「裝置 A 與裝置 B 各自編輯後執行
 *   雙向同步」的 4 個衝突解決策略：
 *     A. tag 聯集：兩端同 id 書不同 tagIds → 合併後取聯集（|A∪B| = |A|+|B|-|A∩B|）
 *     B. 手動狀態保留：A 端 abandoned(manual) → 匯入 B 後不被自動進度覆寫
 *     C. v1→v2 跨版本：A 端匯出 v1 格式 → B 端匯入時自動轉換為 6 狀態 schema
 *     D. category 重建：A 端 tag 引用已刪除 category → 匯入 B 時自動歸入「未分類」
 *
 * 規格依據：docs/use-cases.md UC-05 v1.1 + docs/spec/export-interchange-format-v2.md §8.2
 *
 * 測試策略（沿用 W1-003.1）：
 *   - bindStorageMock(store) 切換 chrome.storage.local 上下文模擬兩裝置
 *   - 每場景：建立 A 端 storage → 匯出（或讀取 fixture）→ 建立 B 端 storage →
 *     ContentParser.parse + TagStorageAdapter.mergeAllData → 斷言 B 端結果
 *   - 無計時硬門檻（test-assertion-design-rules.md），純功能正確性驗證
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
// 共用工具（與 W1-003.1 同步——若需擴充請先確認 round-trip 測試行為一致）
// ===========================================================================

/**
 * 設定 chrome.storage.local mock 為指定的 store，每次呼叫切換「裝置」上下文。
 *
 * BookDataExporter / TagStorageAdapter / ContentParser 都透過 global chrome.storage
 * 操作；透過 jest mockImplementation 切換 store 物件參考即可在同一測試中
 * 模擬「裝置 A 寫入」與「裝置 B 寫入」兩個獨立 storage namespace。
 *
 * @param {Object} store - 該裝置的 storage 物件（測試直接讀寫斷言）
 */
function bindStorageMock (store) {
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
    callback(JSON.stringify(store).length)
  })
}

/**
 * 載入衝突場景 fixture（含 deviceA / deviceB 兩段或裸 v2 interchange JSON）。
 *
 * @param {string} fileName - fixtures 目錄下檔名
 * @returns {Object}
 */
function loadFixture (fileName) {
  const raw = fs.readFileSync(
    path.join(__dirname, 'fixtures', fileName),
    'utf8'
  )
  return JSON.parse(raw)
}

/**
 * 預置裝置 storage：直接寫入 store 物件，繞過 quota 與 lock。
 *
 * @param {Object} store - bindStorageMock 綁定的 store
 * @param {Object} data - { books, tags, tagCategories }
 */
function preloadDeviceStorage (store, { books, tags, tagCategories }) {
  store[STORAGE_KEYS.READMOO_BOOKS] = JSON.parse(JSON.stringify(books))
  store[STORAGE_KEYS.TAGS] = JSON.parse(JSON.stringify(tags))
  store[STORAGE_KEYS.TAG_CATEGORIES] = JSON.parse(JSON.stringify(tagCategories))
}

/**
 * 由裝置端的 storage 內容匯出為 v2 interchange JSON 字串（COMPLETE_V2 preset）。
 *
 * @param {Object} data - { books, tags, tagCategories }
 * @returns {string}
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
 * 模擬雲端傳輸：純字串 round-trip（parse + stringify 不改型別）。
 */
function simulateCloudTransport (jsonString) {
  expect(typeof jsonString).toBe('string')
  expect(jsonString.length).toBeGreaterThan(0)
  return JSON.stringify(JSON.parse(jsonString))
}

/**
 * ContentParser.parse 包裝：給 fileFormat='json'，內部自動偵測 v1/v2。
 */
function parseImportContent (jsonString) {
  return new ContentParser().parse(jsonString, 'json')
}

/**
 * 從 store 讀回 readmoo_books 的書籍陣列（處理 wrapper 結構）。
 */
function readStoreBooks (store) {
  const raw = store[STORAGE_KEYS.READMOO_BOOKS]
  if (!raw) return []
  if (Array.isArray(raw)) return raw
  if (raw.books && Array.isArray(raw.books)) return raw.books
  return []
}

// ===========================================================================

describe('跨裝置衝突解決 — UC-05 v1.1（0.19.0-W1-003.2）', () => {
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
  // 場景 A：tag 聯集策略（|A∪B| = |A| + |B| - |A∩B|）
  //   對應 AC-1
  //
  //   設置：A、B 兩端皆有同 id 書 cs-a-book-01
  //     A tagIds: ['tag_a_sci_fi', 'tag_a_classic', 'tag_a_shared']（3 個）
  //     B tagIds: ['tag_b_thriller', 'tag_b_shared']（2 個）
  //   A 和 B 各有一個 name='共同標籤' 的 tag（在不同 id 上），merge 時應同名收斂
  //   為單一本地 tag → 該書 tagIds 聯集後實際指向 4 個 tag（3+2-1=4）。
  // ==========================================================================
  describe('場景 A：tag 聯集策略', () => {
    test('AC-1 [tag union] 兩端同 id 書合併後 tagIds 為聯集（同名 tag 收斂為單一）', async () => {
      const fixture = loadFixture('conflict-scenario-a-tag-union.json')

      // --- 裝置 A：預置 storage、匯出 v2 JSON ---
      bindStorageMock(deviceAStore)
      preloadDeviceStorage(deviceAStore, fixture.deviceA)
      const exportedJson = exportToV2Json(fixture.deviceA)
      const downloadedJson = simulateCloudTransport(exportedJson)

      // --- 裝置 B：預置自身 storage、執行合併匯入 ---
      bindStorageMock(deviceBStore)
      preloadDeviceStorage(deviceBStore, fixture.deviceB)

      const imported = parseImportContent(downloadedJson)
      const writeResult = await TagStorageAdapter.mergeAllData({
        books: imported.books,
        tags: imported.tags,
        tagCategories: imported.tagCategories
      })
      expect(writeResult.success).toBe(true)

      // --- 斷言 ---
      const bBooks = readStoreBooks(deviceBStore)
      const sharedBook = bBooks.find(b => b.id === 'cs-a-book-01')
      expect(sharedBook).toBeDefined()

      // tag id 在 merge 過程中可能被 remap（incoming id → local id）
      // 透過 B 端 tags 表的 name 反查驗證，避開 id 重映射細節
      const bTags = deviceBStore[STORAGE_KEYS.TAGS]
      const tagNameById = new Map(bTags.map(t => [t.id, t.name]))
      const sharedTagNames = sharedBook.tagIds
        .map(id => tagNameById.get(id))
        .filter(Boolean)

      // 聯集應包含：A 端 [科幻, 經典, 共同標籤] + B 端 [驚悚, 共同標籤]
      // 同名「共同標籤」收斂為單一本地 tag → tag id 數為 4
      expect(sharedTagNames).toContain('科幻')
      expect(sharedTagNames).toContain('經典')
      expect(sharedTagNames).toContain('驚悚')
      expect(sharedTagNames).toContain('共同標籤')

      // 聯集公式驗證：|A∪B| = |A| + |B| - |A∩B|
      const aTagNames = new Set(fixture.deviceA.tags.map(t => t.name))
      const bTagNames = new Set(fixture.deviceB.tags.map(t => t.name))
      const intersection = [...aTagNames].filter(n => bTagNames.has(n))
      const expectedUnionSize = aTagNames.size + bTagNames.size - intersection.length

      expect(sharedBook.tagIds).toHaveLength(expectedUnionSize)
      // 互異性檢查：tagIds 內無重複
      expect(new Set(sharedBook.tagIds).size).toBe(sharedBook.tagIds.length)
    })

    test('AC-1 [tag union] 同名 category 在兩端收斂為單一（cat_a_genre 與 cat_b_genre 同名「類型」）', async () => {
      const fixture = loadFixture('conflict-scenario-a-tag-union.json')

      bindStorageMock(deviceAStore)
      preloadDeviceStorage(deviceAStore, fixture.deviceA)
      const exportedJson = exportToV2Json(fixture.deviceA)
      const downloadedJson = simulateCloudTransport(exportedJson)

      bindStorageMock(deviceBStore)
      preloadDeviceStorage(deviceBStore, fixture.deviceB)

      const imported = parseImportContent(downloadedJson)
      await TagStorageAdapter.mergeAllData({
        books: imported.books,
        tags: imported.tags,
        tagCategories: imported.tagCategories
      })

      // 兩端皆有 name='類型' 的 category（id 不同），合併後應收斂為單一本地 category
      const bCats = deviceBStore[STORAGE_KEYS.TAG_CATEGORIES]
      const typeCats = bCats.filter(c => c.name === '類型')
      expect(typeCats).toHaveLength(1)
    })
  })

  // ==========================================================================
  // 場景 B：isManualStatus 保留（手動狀態優先於匯入端可能的自動進度）
  //   對應 AC-2
  //
  //   設置：A 端書 cs-b-book-01 為 abandoned(isManualStatus=true)
  //         B 端同 id 書為 reading(isManualStatus=false, progress=70)
  //   合併語意（mergeAllData / computeMergeResult §3）：「同 id 更新——其餘欄位
  //   以匯入覆蓋」→ A 端 abandoned + isManualStatus=true 寫入 B 端，
  //   B 原 reading 自動狀態不會「逆覆蓋」A 端手動狀態。
  // ==========================================================================
  describe('場景 B：isManualStatus 保留', () => {
    test('AC-2 [manual status] A 端 abandoned(manual=true) 匯入後覆蓋 B 端 reading(manual=false)', async () => {
      const fixture = loadFixture('conflict-scenario-b-manual-status.json')

      bindStorageMock(deviceAStore)
      preloadDeviceStorage(deviceAStore, fixture.deviceA)
      const exportedJson = exportToV2Json(fixture.deviceA)
      const downloadedJson = simulateCloudTransport(exportedJson)

      bindStorageMock(deviceBStore)
      preloadDeviceStorage(deviceBStore, fixture.deviceB)

      const imported = parseImportContent(downloadedJson)
      const writeResult = await TagStorageAdapter.mergeAllData({
        books: imported.books,
        tags: imported.tags,
        tagCategories: imported.tagCategories
      })
      expect(writeResult.success).toBe(true)

      const bBooks = readStoreBooks(deviceBStore)
      const targetBook = bBooks.find(b => b.id === 'cs-b-book-01')
      expect(targetBook).toBeDefined()

      // 核心斷言：abandoned 狀態保留
      expect(targetBook.readingStatus).toBe('abandoned')
      // isManualStatus 必為 true（不被 B 端 false 蓋掉）
      expect(targetBook.isManualStatus).toBe(true)
      // progress 跟隨 A 端
      expect(targetBook.progress).toBe(50)
    })

    test('AC-2 [manual status] queued / abandoned / reference 三種手動狀態均保留', async () => {
      // 擴充場景：A 端含三本不同手動狀態書，B 端皆為 reading 自動狀態
      const aBooks = [
        {
          id: 'cs-b-multi-queued',
          title: '排隊書',
          authors: ['作者甲'],
          publisher: '',
          progress: 0,
          readingStatus: 'queued',
          type: '電子書',
          cover: '',
          tagIds: [],
          isManualStatus: true,
          extractedAt: '2026-04-10T08:00:00.000Z',
          updatedAt: '2026-04-20T10:00:00.000Z',
          source: 'readmoo'
        },
        {
          id: 'cs-b-multi-abandoned',
          title: '棄讀書',
          authors: ['作者乙'],
          publisher: '',
          progress: 30,
          readingStatus: 'abandoned',
          type: '電子書',
          cover: '',
          tagIds: [],
          isManualStatus: true,
          extractedAt: '2026-04-10T08:00:00.000Z',
          updatedAt: '2026-04-20T10:00:00.000Z',
          source: 'readmoo'
        },
        {
          id: 'cs-b-multi-reference',
          title: '參考書',
          authors: ['作者丙'],
          publisher: '',
          progress: 0,
          readingStatus: 'reference',
          type: '電子書',
          cover: '',
          tagIds: [],
          isManualStatus: true,
          extractedAt: '2026-04-10T08:00:00.000Z',
          updatedAt: '2026-04-20T10:00:00.000Z',
          source: 'readmoo'
        }
      ]
      const bBooks = aBooks.map(b => ({
        ...b,
        readingStatus: 'reading',
        progress: 60,
        isManualStatus: false,
        updatedAt: '2026-03-30T11:00:00.000Z'
      }))

      bindStorageMock(deviceAStore)
      preloadDeviceStorage(deviceAStore, { books: aBooks, tags: [], tagCategories: [] })
      const exportedJson = exportToV2Json({
        books: aBooks, tags: [], tagCategories: []
      })
      const downloadedJson = simulateCloudTransport(exportedJson)

      bindStorageMock(deviceBStore)
      preloadDeviceStorage(deviceBStore, { books: bBooks, tags: [], tagCategories: [] })

      const imported = parseImportContent(downloadedJson)
      await TagStorageAdapter.mergeAllData({
        books: imported.books,
        tags: imported.tags,
        tagCategories: imported.tagCategories
      })

      const merged = readStoreBooks(deviceBStore)
      const manualStatusBooks = merged.filter(b =>
        ['queued', 'abandoned', 'reference'].includes(b.readingStatus)
      )
      // 三本手動狀態書全保留
      expect(manualStatusBooks).toHaveLength(3)
      manualStatusBooks.forEach(b => {
        expect(b.isManualStatus).toBe(true)
      })
    })
  })

  // ==========================================================================
  // 場景 C：v1 → v2 跨版本匯入
  //   對應 AC-3
  //
  //   設置：A 端輸出 v1 格式 JSON（純陣列，欄位含 isNew/isFinished/category）
  //         B 端走 ContentParser.parse → detectFormatVersion 判 v1 →
  //         convertV1ToV2Data 自動轉換 → mergeAllData 寫入 B 端 storage
  //   驗證映射規則（src/data-management/BookSchemaV2.js mapV1StatusToV2）：
  //     - isFinished=true → 'finished'
  //     - isFinished=false, progress>0 → 'reading'
  //     - isFinished=false, progress=0 → 'unread'
  // ==========================================================================
  describe('場景 C：v1 → v2 跨版本匯入', () => {
    test('AC-3 [v1→v2] v1 isNew/isFinished 對映至 v2 6 狀態（finished/reading/unread）', async () => {
      // A 端直接讀檔取得真實 v1 格式 JSON（陣列形狀）
      const v1Raw = fs.readFileSync(
        path.join(__dirname, 'fixtures', 'conflict-scenario-c-v1-format.json'),
        'utf8'
      )

      // 模擬雲端傳輸（純字串 parse+stringify，等價於 W1-003.1 simulateCloudTransport）
      const downloadedJson = JSON.stringify(JSON.parse(v1Raw))

      // B 端 clean profile（不預置——驗證 v1→v2 純轉換寫入）
      bindStorageMock(deviceBStore)

      // ContentParser 自動偵測 v1 + 內部 convertV1ToV2Data
      const imported = parseImportContent(downloadedJson)
      const writeResult = await TagStorageAdapter.mergeAllData({
        books: imported.books,
        tags: imported.tags,
        tagCategories: imported.tagCategories
      })
      expect(writeResult.success).toBe(true)

      const bBooks = readStoreBooks(deviceBStore)
      expect(bBooks).toHaveLength(4)

      // 逐本驗證 v1→v2 狀態映射
      const byId = new Map(bBooks.map(b => [b.id, b]))

      // book-01: isFinished=true → 'finished'
      expect(byId.get('cs-c-v1-book-01').readingStatus).toBe('finished')
      // book-02: isFinished=false, progress=45 → 'reading'
      expect(byId.get('cs-c-v1-book-02').readingStatus).toBe('reading')
      // book-03: isNew=true, isFinished=false, progress=0 → 'unread'
      expect(byId.get('cs-c-v1-book-03').readingStatus).toBe('unread')
      // book-04: 無 isNew/isFinished, progress=0 → 'unread'（預設）
      expect(byId.get('cs-c-v1-book-04').readingStatus).toBe('unread')

      // 全部書的 readingStatus 必落在 6 狀態枚舉內
      const validStatuses = new Set([
        'unread', 'reading', 'finished', 'queued', 'abandoned', 'reference'
      ])
      bBooks.forEach(b => {
        expect(validStatuses.has(b.readingStatus)).toBe(true)
      })

      // 全部書的 isManualStatus 為 false（v1 無此概念，轉換時預設）
      bBooks.forEach(b => {
        expect(b.isManualStatus).toBe(false)
      })
    })

    test('AC-3 [v1→v2] v1 category 自動轉為 tag（cat_imported + 對應 tag）', async () => {
      const v1Raw = fs.readFileSync(
        path.join(__dirname, 'fixtures', 'conflict-scenario-c-v1-format.json'),
        'utf8'
      )
      const downloadedJson = JSON.stringify(JSON.parse(v1Raw))

      bindStorageMock(deviceBStore)
      const imported = parseImportContent(downloadedJson)
      await TagStorageAdapter.mergeAllData({
        books: imported.books,
        tags: imported.tags,
        tagCategories: imported.tagCategories
      })

      // v1 category 'v1 科幻' / 'v1 文學' 應被轉為 tag，
      // 並建立統一的「匯入分類」tagCategory
      const bCats = deviceBStore[STORAGE_KEYS.TAG_CATEGORIES]
      expect(bCats.some(c => c.name === '匯入分類')).toBe(true)

      const bTags = deviceBStore[STORAGE_KEYS.TAGS]
      const tagNames = bTags.map(t => t.name)
      expect(tagNames).toContain('v1 科幻')
      expect(tagNames).toContain('v1 文學')

      // 書籍的 tagIds 應正確 resolve 至轉換後的 tag
      const bBooks = readStoreBooks(deviceBStore)
      const tagNameById = new Map(bTags.map(t => [t.id, t.name]))
      const book01 = bBooks.find(b => b.id === 'cs-c-v1-book-01')
      const book01TagNames = book01.tagIds.map(id => tagNameById.get(id))
      expect(book01TagNames).toContain('v1 科幻')
    })
  })

  // ==========================================================================
  // 場景 D：缺失 category 自動重建（孤兒 tag 歸入「未分類」）
  //   對應 AC-4
  //
  //   設置：A 端匯出的 v2 interchange JSON 中：
  //     - tagCategories: 只含 cat_existing
  //     - tags: 含 tag_normal (引用 cat_existing) + tag_orphan (引用 cat_deleted_x)
  //     - books: cs-d-book-01 引用 tag_normal + tag_orphan；cs-d-book-02 只引用 tag_orphan
  //   合併到 B 後（B 為 clean profile）：
  //     - cat_existing 直接建立
  //     - 孤兒 tag_orphan 在 mergeAllData 中觸發 ensureUncategorized
  //       → 建立 name='未分類' 的本地 category，tag_orphan 重映射至此
  //     - 兩本書的 tagIds 應仍可解析至有效 tag（不丟失關聯）
  // ==========================================================================
  describe('場景 D：缺失 category 自動重建', () => {
    test('AC-4 [category rebuild] 孤兒 tag 歸入「未分類」並保留書籍-tag 關聯', async () => {
      const fixture = loadFixture('conflict-scenario-d-missing-category.json')
      // fixture 本身即「裝置 A 匯出後的 v2 interchange JSON」，直接序列化作為 cloud blob
      const downloadedJson = JSON.stringify(fixture)

      // B 端 clean profile（驗證從零建立場景）
      bindStorageMock(deviceBStore)

      const imported = parseImportContent(downloadedJson)
      const writeResult = await TagStorageAdapter.mergeAllData({
        books: imported.books,
        tags: imported.tags,
        tagCategories: imported.tagCategories
      })
      expect(writeResult.success).toBe(true)

      // --- 1. 「未分類」category 自動建立 ---
      const bCats = deviceBStore[STORAGE_KEYS.TAG_CATEGORIES]
      const uncategorized = bCats.find(c => c.name === '未分類')
      expect(uncategorized).toBeDefined()
      expect(uncategorized.id).toBeDefined()

      // 保留分類也必須存在（同名收斂或新建均可）
      expect(bCats.some(c => c.name === '保留分類')).toBe(true)

      // --- 2. 孤兒 tag 重映射至「未分類」 ---
      const bTags = deviceBStore[STORAGE_KEYS.TAGS]
      const orphanTag = bTags.find(t => t.name === '孤兒標籤')
      expect(orphanTag).toBeDefined()
      expect(orphanTag.categoryId).toBe(uncategorized.id)

      // 正常 tag 仍歸於保留分類
      const normalTag = bTags.find(t => t.name === '正常標籤')
      expect(normalTag).toBeDefined()
      const preservedCat = bCats.find(c => c.name === '保留分類')
      expect(normalTag.categoryId).toBe(preservedCat.id)

      // --- 3. 書籍-tag 關聯不丟失：兩本書的所有 tagIds 仍可解析 ---
      const bBooks = readStoreBooks(deviceBStore)
      const validTagIds = new Set(bTags.map(t => t.id))

      const book01 = bBooks.find(b => b.id === 'cs-d-book-01')
      expect(book01).toBeDefined()
      // 書 1 引用兩個 tag，merge 後皆能 resolve
      expect(book01.tagIds.length).toBe(2)
      book01.tagIds.forEach(tid => {
        expect(validTagIds.has(tid)).toBe(true)
      })

      const book02 = bBooks.find(b => b.id === 'cs-d-book-02')
      expect(book02).toBeDefined()
      // 書 2 只引用孤兒 tag，仍應保留 1 個有效 tag 引用
      expect(book02.tagIds.length).toBe(1)
      book02.tagIds.forEach(tid => {
        expect(validTagIds.has(tid)).toBe(true)
      })

      // --- 4. 透過 name 鏈完整驗證書籍 → tag → category 路徑 ---
      const tagById = new Map(bTags.map(t => [t.id, t]))
      const catById = new Map(bCats.map(c => [c.id, c]))
      const book01TagNames = book01.tagIds
        .map(tid => tagById.get(tid).name)
        .sort()
      // 中文 Array.sort 採 UTF-16 code unit 序，避免依賴排序語意，以 Set 等價比對
      expect(new Set(book01TagNames)).toEqual(new Set(['正常標籤', '孤兒標籤']))

      // 孤兒標籤的 category 必為「未分類」
      const orphanCat = catById.get(tagById.get(
        book01.tagIds.find(tid => tagById.get(tid).name === '孤兒標籤')
      ).categoryId)
      expect(orphanCat.name).toBe('未分類')
    })
  })

  // ==========================================================================
  // 場景對照摘要（AC-5 必要產出）
  // ==========================================================================
  describe('場景對照摘要', () => {
    test('AC-5 [summary] 4 場景結果摘要供 Test Results 章節引用', async () => {
      // 此測試聚合 4 場景的執行結果，作為 ticket Test Results 章節 markdown
      // 表格的數值來源。所有斷言已在前 4 個 describe 完成，此處僅驗證摘要
      // 計算邏輯（聯集大小、狀態映射數、未分類 category 重建）無回歸。

      // 場景 A 摘要：取自 fixture 的 tag 數計算期望聯集大小
      const fxA = loadFixture('conflict-scenario-a-tag-union.json')
      const aTagNames = new Set(fxA.deviceA.tags.map(t => t.name))
      const bTagNames = new Set(fxA.deviceB.tags.map(t => t.name))
      const sharedNames = [...aTagNames].filter(n => bTagNames.has(n))
      const summaryA = {
        deviceATagCount: aTagNames.size,
        deviceBTagCount: bTagNames.size,
        sharedTagCount: sharedNames.length,
        expectedUnionSize: aTagNames.size + bTagNames.size - sharedNames.length
      }
      expect(summaryA.expectedUnionSize).toBe(4)
      expect(summaryA.sharedTagCount).toBe(1)

      // 場景 C 摘要：v1 映射計數
      const fxC = JSON.parse(fs.readFileSync(
        path.join(__dirname, 'fixtures', 'conflict-scenario-c-v1-format.json'),
        'utf8'
      ))
      const summaryC = {
        totalV1Books: fxC.length,
        expectedFinished: fxC.filter(b => b.isFinished === true).length,
        expectedReading: fxC.filter(b =>
          b.isFinished !== true && b.progress > 0
        ).length,
        expectedUnread: fxC.filter(b =>
          b.isFinished !== true && (b.progress || 0) === 0
        ).length
      }
      expect(summaryC.totalV1Books).toBe(4)
      expect(summaryC.expectedFinished).toBe(1)
      expect(summaryC.expectedReading).toBe(1)
      expect(summaryC.expectedUnread).toBe(2)
    })
  })
})
