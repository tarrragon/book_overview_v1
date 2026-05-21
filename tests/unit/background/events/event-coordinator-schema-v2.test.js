/**
 * RED 測試：event-coordinator BookSchemaV2 model 轉換層
 *
 * Ticket: 0.19.0-W1-009（TDD Phase 2 測試設計）
 *
 * 測試目標：
 *   驗證 EventCoordinator 的 EXTRACTION.COMPLETED handler 在寫入
 *   chrome.storage.local 前，對每本 book 先依 progress derive readingStatus
 *   （BookSchemaV2.mapV1StatusToV2），再呼叫 BookSchemaV2.applyDefaults()，
 *   使存入 storage 的每本書符合 BookSchemaV2（含 readingStatus、tagIds、
 *   isManualStatus、schemaVersion）。
 *
 * 測試層次：
 *   - U1（derivation 規則對照）— 對 BookSchemaV2.mapV1StatusToV2 的契約鎖定，
 *     確保 Phase 3 接線時依賴的 derive 行為符合 Phase 1 D1 邊界表。
 *   - U3（handler 整合）— 透過真實 EventCoordinator + EventBus 路徑驅動，
 *     斷言 chrome.storage.local.set 收到的 readmoo_books.books 每本合規。
 *     U2（applyDefaults 填充）的效果由 U3 整合測試一併斷言。
 *
 * RED 預期：本測試在 event-coordinator.js 加入 model 轉換層之前應失敗
 *   （現行 handler 僅做 tags 正規化，不產出 readingStatus / tagIds /
 *   isManualStatus / schemaVersion）。
 *
 * 第 8 項欄位名鎖定結論：
 *   - 「per-book schema 版本欄位」採 camelCase `schemaVersion`，值 '3.0.0'。
 *   - 依據：consumer 掃描（src/overview/、src/export/）無任何「逐本書」讀取
 *     schema 版本的點。export 模組的 `schemaVersion` 位於 metadata 物件
 *     （非逐本書）；tag-storage-adapter 的 `schema_version` 是 storage 頂層
 *     key（STORAGE_KEYS.SCHEMA_VERSION），亦非逐本書欄位。
 *   - 因無既有逐本書讀取點，採與 book 物件既有欄位（extractedAt/coverInfo）
 *     一致的 camelCase `schemaVersion`，對齊 Phase 1 D4 定案。
 */

const BookSchemaV2 = require('src/data-management/BookSchemaV2')

describe('event-coordinator BookSchemaV2 model 轉換層（RED）', () => {
  // ===========================================================================
  // U1：progress → readingStatus derivation 邊界對照（契約鎖定）
  //
  // 對應 Phase 1 D1 邊界表與「待 Phase 2 測試覆蓋的行為清單」第 1 項。
  // derive 邏輯本身屬 BookSchemaV2（已有單元測試），此處鎖定 handler 接線
  // 將依賴的契約：mapV1StatusToV2 對「無 isFinished 的提取 book」之行為。
  // ===========================================================================
  describe('U1 readingStatus derivation 全 progress 邊界', () => {
    const derivationCases = [
      { label: 'progress=0 → unread', book: { progress: 0 }, expected: 'unread' },
      { label: 'progress=45（0<p<100）→ reading', book: { progress: 45 }, expected: 'reading' },
      { label: 'progress=100 → finished', book: { progress: 100 }, expected: 'finished' },
      { label: 'progress=null → unread', book: { progress: null }, expected: 'unread' },
      { label: 'progress=undefined → unread', book: {}, expected: 'unread' },
      { label: 'progress=NaN → unread', book: { progress: NaN }, expected: 'unread' },
      { label: 'progress=-5（負值）→ unread', book: { progress: -5 }, expected: 'unread' },
      { label: 'progress=150（>100）→ finished', book: { progress: 150 }, expected: 'finished' },
      { label: 'progress="45"（字串）→ reading', book: { progress: '45' }, expected: 'reading' }
    ]

    test.each(derivationCases)('$label', ({ book, expected }) => {
      // When: 以提取 book（無 isFinished/isNew）derive readingStatus
      const derived = BookSchemaV2.mapV1StatusToV2(book)

      // Then: 對應 Phase 1 D1 邊界表
      expect(derived).toBe(expected)
    })
  })

  // ===========================================================================
  // U3：handler 整合 — EXTRACTION.COMPLETED → chrome.storage.local.set
  //
  // 透過真實 EventCoordinator + EventBus 路徑驅動（從呼叫路徑出發），
  // 斷言寫入 storage 的每本書符合 BookSchemaV2。
  // ===========================================================================
  describe('U3 EXTRACTION.COMPLETED handler 整合', () => {
    let coordinator

    /**
     * 取得 storage.local.set 最近一次寫入的 readmoo_books.books
     * @returns {Array|undefined}
     */
    function getStoredBooks () {
      const calls = chrome.storage.local.set.mock.calls
      if (calls.length === 0) return undefined
      const lastCall = calls[calls.length - 1][0]
      return lastCall.readmoo_books && lastCall.readmoo_books.books
    }

    /**
     * 建立並啟動 EventCoordinator，回傳其 eventBus
     * registerExtractionListeners 在 start() 中註冊
     */
    async function createStartedCoordinator () {
      const EventCoordinator = require('src/background/events/event-coordinator')
      coordinator = new EventCoordinator()
      await coordinator.initialize()
      await coordinator.start()
      return coordinator.eventBusInstance
    }

    afterEach(() => {
      // 清理模組快取，避免測試間 SW 模組狀態汙染
      Object.keys(require.cache).forEach(key => {
        if (key.includes('src/background/')) {
          delete require.cache[key]
        }
      })
      jest.clearAllMocks()
    })

    // -------------------------------------------------------------------------
    // 場景 1：正常提取 — progress 涵蓋三種自動狀態（正常流程）
    // 行為清單第 1、3 項
    // -------------------------------------------------------------------------
    test('場景 1：progress=0/45/100 三本書 derive 為 unread/reading/finished', async () => {
      // Given: EXTRACTION.COMPLETED 帶 progress=0、45、100 三本書
      const eventBus = await createStartedCoordinator()
      const mockBooks = [
        { id: 'b-0', title: '未讀書', progress: 0 },
        { id: 'b-45', title: '閱讀中書', progress: 45 },
        { id: 'b-100', title: '已完成書', progress: 100 }
      ]

      // When: handler 處理事件並寫入 storage
      await eventBus.emit('EXTRACTION.COMPLETED', {
        booksData: mockBooks,
        count: mockBooks.length,
        source: 'readmoo'
      })

      // Then: 寫入的 readmoo_books.books 對應正確 readingStatus
      const stored = getStoredBooks()
      expect(stored).toHaveLength(3)
      expect(stored[0].readingStatus).toBe('unread')
      expect(stored[1].readingStatus).toBe('reading')
      expect(stored[2].readingStatus).toBe('finished')
    })

    // -------------------------------------------------------------------------
    // 場景 1（續）：每本書含 model 預設欄位
    // 行為清單第 2、3 項（U2 applyDefaults 填充效果）
    // -------------------------------------------------------------------------
    test('場景 1：每本書含 tagIds:[]、isManualStatus:false、schemaVersion', async () => {
      // Given: 一本標準提取 book（無 tagIds/isManualStatus/schemaVersion）
      const eventBus = await createStartedCoordinator()
      const mockBooks = [{ id: 'b-1', title: '測試書', progress: 30 }]

      // When: handler 處理事件
      await eventBus.emit('EXTRACTION.COMPLETED', {
        booksData: mockBooks,
        count: 1,
        source: 'readmoo'
      })

      // Then: book 符合 BookSchemaV2 預設欄位
      const stored = getStoredBooks()
      expect(stored).toHaveLength(1)
      const book = stored[0]
      expect(book.readingStatus).toBe('reading')
      expect(book.tagIds).toEqual([])
      expect(book.isManualStatus).toBe(false)
      // 第 8 項鎖定：per-book 欄位名 = camelCase schemaVersion，值 '3.0.0'
      expect(book.schemaVersion).toBe('3.0.0')
      expect(book.schemaVersion).toBe(BookSchemaV2.SCHEMA_VERSION)
    })

    // -------------------------------------------------------------------------
    // 場景 1（續）：tagIds 應為全新獨立陣列，每本書不共用同一參照
    // 對應 Q9：避免「碰巧通過」— applyDefaults array default 須 clone
    // -------------------------------------------------------------------------
    test('場景 1：各書 tagIds 為獨立陣列實例（不共用參照）', async () => {
      // Given: 兩本書
      const eventBus = await createStartedCoordinator()
      const mockBooks = [
        { id: 'b-a', title: '書 A', progress: 10 },
        { id: 'b-b', title: '書 B', progress: 20 }
      ]

      // When
      await eventBus.emit('EXTRACTION.COMPLETED', {
        booksData: mockBooks,
        count: 2,
        source: 'readmoo'
      })

      // Then: 兩書 tagIds 皆為 [] 但非同一物件參照
      const stored = getStoredBooks()
      expect(stored[0].tagIds).toEqual([])
      expect(stored[1].tagIds).toEqual([])
      expect(stored[0].tagIds).not.toBe(stored[1].tagIds)
    })

    // -------------------------------------------------------------------------
    // 場景 2：progress 異常值不中斷整批儲存（邊界條件）
    // 行為清單第 1、7 項
    // -------------------------------------------------------------------------
    test('場景 2：progress 異常值（null/undefined/NaN/-5/150）全數寫入且不漏書', async () => {
      // Given: 五本書，progress 為 null/undefined/NaN/-5/150
      const eventBus = await createStartedCoordinator()
      const mockBooks = [
        { id: 'b-null', title: 'null 書', progress: null },
        { id: 'b-undef', title: 'undefined 書' }, // 無 progress 欄位
        { id: 'b-nan', title: 'NaN 書', progress: NaN },
        { id: 'b-neg', title: '負值書', progress: -5 },
        { id: 'b-over', title: '超界書', progress: 150 }
      ]

      // When: handler 處理事件（不應丟錯）
      await expect(
        eventBus.emit('EXTRACTION.COMPLETED', {
          booksData: mockBooks,
          count: mockBooks.length,
          source: 'readmoo'
        })
      ).resolves.not.toThrow()

      // Then: 五本書全數寫入，異常值 → unread、150 → finished
      const stored = getStoredBooks()
      expect(stored).toHaveLength(5)
      expect(stored[0].readingStatus).toBe('unread') // null
      expect(stored[1].readingStatus).toBe('unread') // undefined
      expect(stored[2].readingStatus).toBe('unread') // NaN
      expect(stored[3].readingStatus).toBe('unread') // -5
      expect(stored[4].readingStatus).toBe('finished') // 150
      // 每本書都有合規 readingStatus（非 undefined）
      stored.forEach(book => {
        expect(book.readingStatus).not.toBeUndefined()
      })
    })

    // -------------------------------------------------------------------------
    // 場景 3：空 books 陣列（邊界條件）— 既有行為不回歸
    // 行為清單第 6 項
    // -------------------------------------------------------------------------
    test('場景 3：空 books 陣列寫入 readmoo_books.books = []，不丟錯', async () => {
      // Given: EXTRACTION.COMPLETED books 為 []
      const eventBus = await createStartedCoordinator()

      // When
      await expect(
        eventBus.emit('EXTRACTION.COMPLETED', {
          booksData: [],
          count: 0,
          source: 'readmoo'
        })
      ).resolves.not.toThrow()

      // Then: 寫入空陣列，map 不產出任何書
      const stored = getStoredBooks()
      expect(stored).toEqual([])
    })

    // -------------------------------------------------------------------------
    // 場景 4：books 缺失或非陣列（異常流程）— 既有行為不回歸
    // 行為清單第 6 項
    // -------------------------------------------------------------------------
    test('場景 4：缺 books 欄位時不寫 storage（維持既有 else 分支）', async () => {
      // Given: 事件 data 無 books / booksData
      const eventBus = await createStartedCoordinator()

      // When
      await expect(
        eventBus.emit('EXTRACTION.COMPLETED', {
          count: 0,
          source: 'readmoo'
        })
      ).resolves.not.toThrow()

      // Then: 不呼叫 storage.set 寫入 readmoo_books
      const calls = chrome.storage.local.set.mock.calls
      const wroteBooks = calls.some(call => call[0] && call[0].readmoo_books)
      expect(wroteBooks).toBe(false)
    })

    test('場景 4：books 為非陣列（物件）時不寫 storage', async () => {
      // Given: booksData 為非陣列值
      const eventBus = await createStartedCoordinator()

      // When
      await expect(
        eventBus.emit('EXTRACTION.COMPLETED', {
          booksData: { not: 'an array' },
          source: 'readmoo'
        })
      ).resolves.not.toThrow()

      // Then: 不寫入 readmoo_books
      const calls = chrome.storage.local.set.mock.calls
      const wroteBooks = calls.some(call => call[0] && call[0].readmoo_books)
      expect(wroteBooks).toBe(false)
    })

    // -------------------------------------------------------------------------
    // 場景 5：既有 tags 欄位保留與 tagIds 並存（正常流程）
    // 行為清單第 5 項
    // -------------------------------------------------------------------------
    test('場景 5：既有 tags 欄位保留（含 readmoo），與新增 tagIds 並存', async () => {
      // Given: 提取 book 已含 tags:["readmoo"]，無 tagIds
      const eventBus = await createStartedCoordinator()
      const mockBooks = [
        { id: 'b-tag', title: '帶 tags 的書', progress: 50, tags: ['readmoo'] }
      ]

      // When
      await eventBus.emit('EXTRACTION.COMPLETED', {
        booksData: mockBooks,
        count: 1,
        source: 'readmoo'
      })

      // Then: tags 保留（含 readmoo），tagIds 為新增 []
      const stored = getStoredBooks()
      const book = stored[0]
      expect(book.tags).toContain('readmoo')
      expect(book.tagIds).toEqual([])
      // tags 與 tagIds 為不同欄位，並存不互相取代
      expect(book.tags).not.toBe(book.tagIds)
    })

    // -------------------------------------------------------------------------
    // 場景 6：derive 先於 applyDefaults 的順序正確性
    // 行為清單第 4 項
    //
    // 防護要點：applyDefaults 只在欄位 === undefined 時填預設（會填 unread）。
    // 若實作順序錯誤（先 applyDefaults 後 derive 或漏 derive），progress=100
    // 的書會被 applyDefaults 填成預設 'unread' 而非 derive 出的 'finished'。
    // 此案例選 progress=100，使「正確 derive=finished」與「錯誤預設=unread」
    // 結果不同，確保順序錯誤會被測試捕捉（避免 Q9 碰巧通過）。
    // -------------------------------------------------------------------------
    test('場景 6：progress=100 的書 readingStatus 為 derive 結果 finished，非預設 unread', async () => {
      // Given: progress=100 的書，無 readingStatus 欄位
      const eventBus = await createStartedCoordinator()
      const mockBooks = [{ id: 'b-order', title: '順序驗證書', progress: 100 }]

      // When: handler derive + applyDefaults
      await eventBus.emit('EXTRACTION.COMPLETED', {
        booksData: mockBooks,
        count: 1,
        source: 'readmoo'
      })

      // Then: readingStatus = derive 結果 finished（若順序錯誤會是預設 unread）
      const stored = getStoredBooks()
      expect(stored[0].readingStatus).toBe('finished')
      expect(stored[0].readingStatus).not.toBe('unread')
    })

    test('場景 6：progress=0 的書 readingStatus 為 derive 結果 unread', async () => {
      // 補充對照：progress=0 derive=unread 與預設 unread 同值，
      // 此案例不單獨證明順序，但確保 progress=0 不被誤判為其他狀態。
      const eventBus = await createStartedCoordinator()
      const mockBooks = [{ id: 'b-zero', title: 'progress 0 書', progress: 0 }]

      await eventBus.emit('EXTRACTION.COMPLETED', {
        booksData: mockBooks,
        count: 1,
        source: 'readmoo'
      })

      const stored = getStoredBooks()
      expect(stored[0].readingStatus).toBe('unread')
    })

    // -------------------------------------------------------------------------
    // 整合斷言：每本書完整符合 BookSchemaV2（validateBook 通過）
    // 行為清單第 3 項 — 端到端驗證 storage book 合規
    // -------------------------------------------------------------------------
    test('整合：寫入 storage 的每本書通過 BookSchemaV2.validateBook', async () => {
      // Given: 三本含必填欄位（id/title）的提取書
      const eventBus = await createStartedCoordinator()
      const mockBooks = [
        { id: 'v-1', title: '驗證書一', progress: 0 },
        { id: 'v-2', title: '驗證書二', progress: 60 },
        { id: 'v-3', title: '驗證書三', progress: 100 }
      ]

      // When
      await eventBus.emit('EXTRACTION.COMPLETED', {
        booksData: mockBooks,
        count: 3,
        source: 'readmoo'
      })

      // Then: 每本書通過 schema 驗證
      const stored = getStoredBooks()
      expect(stored).toHaveLength(3)
      stored.forEach(book => {
        const result = BookSchemaV2.validateBook(book)
        expect(result.valid).toBe(true)
      })
    })
  })
})
