/**
 * uc04-import.e2e.test.js — UC-04 資料匯入真實瀏覽器 E2E regression 測試（W4-001.2）
 *
 * 負責功能：
 * - 在真實 Chrome + 已載入 Extension 環境下，驗證 UC-04 匯入鏈完整路徑：
 *   注入 fixture 檔案至 #jsonFileInput -> 真實 click #loadFileBtn
 *   -> overview-page-controller handleFileLoad -> ImportFlowController.execute
 *   -> 模式 modal（真實 click #importModeOverwriteBtn / #importModeMergeBtn）
 *   -> BookFileImporter（validate / read / parse）-> TagStorageAdapter
 *      replaceAllData / mergeAllData -> chrome.storage.local
 * - 斷言 storage 結果符合 v1.1 model（v1 自動轉換）+ 合併去重（v2 tag 聯集）
 * - 補 W1-001.2 手動驗證後缺少的自動化 regression 防護（quality-baseline 規則 5）
 *
 * 測試定位（regression 鎖定型 E2E）：
 * - 常態 GREEN，鎖定匯入相容性（v1 自動轉換 / v2 tag 聯集 / 去重）不因後續重構而回歸。
 * - 與 uc03-export.e2e.test.js 互補：前者覆蓋 overview 匯出下游（blob 攔截），
 *   本檔覆蓋 overview 匯入上游（檔案注入 + modal 模式選擇 + storage 持久化）。
 *
 * 測試結構分層（前綴揭露失敗性質）：
 * - [SETUP]  前綴：環境 / overview 載入 / controller 就緒前置失敗
 * - [V1]     前綴：v1 格式匯入自動轉換 regression（isNew/isFinished -> 6 狀態、tagIds 恆陣列）
 * - [MERGE]  前綴：v2 合併模式 tag 聯集 + 去重 regression（同 id 不重複、tagIds 取聯集）
 *
 * 檔案注入設計考量：
 * - E2E 環境無真實檔案選擇對話框；採 Puppeteer elementHandle.uploadFile 注入
 *   fixture 至 <input type=file id=jsonFileInput>，完整經過真實 click #loadFileBtn
 *   -> handleFileLoad -> ImportFlowController 全鏈，僅替換「OS 檔案對話框選檔」
 *   這一步以注入既有 fixture，不繞過任何匯入業務邏輯。
 * - #loadFileBtn 位於 #fileUploader（預設 display:none）內，page.click 需元素可見，
 *   故先 click #importJSONBtn 切換 #fileUploader 顯示再 upload + click #loadFileBtn。
 * - 模式 modal（promptImportMode）需真實按鈕 click 才 resolve，故 upload 後依序
 *   click #importModeOverwriteBtn（覆蓋）/ #importModeMergeBtn（合併），完整觸發
 *   ImportFlowController.execute 的模式分流（replaceAllData / mergeAllData）。
 * - 持久化為 async（讀 storage + 計算合併 + 原子寫回三 key），採 polling 等待
 *   storage 書數穩定（禁止固定 sleep，遵循 test-assertion-design-rules）。
 *
 * 規格依據（docs/use-cases.md L189-260）：
 * - v1 格式匯入自動轉換：isNew/isFinished -> 6 種閱讀狀態、category -> tag、無 category 之書 tagIds 為空陣列
 * - v2 合併模式：同 id 更新（tagIds 取聯集去重）、新 id 新增、永不刪除本地（SPEC-EXPORT-V2 §8.2）
 * - 成功標準：格式驗證準確率 100%（v1/v2 皆可）、載入完整性 100%、去重 > 99%
 *
 * Fixture 合併關係（tests/e2e/fixtures/uc04-import/）：
 * - sample-v2-base：book uc04-book-x tagIds=[tag_uc04_a(科幻)]、book uc04-book-y tagIds=[tag_uc04_b(文學)]
 * - sample-v2-merge：book uc04-book-x tagIds=[tag_uc04_c(推理)]（同 id、不同 tag）
 * - 合併後預期：書數恆 2（x 去重不複製、y 原樣保留）；book x tagIds 聯集為 2 個（科幻 + 推理）；
 *   book y tagIds 維持 1 個（文學）；tags 總數 3（科幻 + 文學 + 推理，推理為合併新建）
 *
 * 執行方式：npm run test:e2e:browser（注意：npm run test:e2e 以 testPathIgnorePatterns
 *   排除 browser/，本檔須用 test:e2e:browser）
 * 前置：須先 npm run build:dev 產出 build/development（Extension 載入路徑）
 */

const path = require('path')
const ExtensionTestSetup = require('../setup/extension-setup')
const {
  clearBooksStorage,
  getServiceWorker
} = require('./helpers/storage-reader')
const {
  DEFAULT_NAV_TIMEOUT,
  JEST_TEST_TIMEOUT
} = require('./helpers/timeouts')

// v1.1 model readingStatus 6 狀態 enum（與 export-interchange-format-v2.md §3.6 一致）
const READING_STATUS_ENUM = ['unread', 'reading', 'finished', 'queued', 'abandoned', 'reference']

// UC-04 fixture 絕對路徑（重用既有 fixtures，禁重建）
const FIXTURE_DIR = path.resolve(__dirname, '../fixtures/uc04-import')
const FIXTURE_V1 = path.join(FIXTURE_DIR, 'sample-v1.json')
const FIXTURE_V2_BASE = path.join(FIXTURE_DIR, 'sample-v2-base.json')
const FIXTURE_V2_MERGE = path.join(FIXTURE_DIR, 'sample-v2-merge.json')

// chrome.storage.local 的三個匯入相關 key（對齊 TagStorageAdapter.STORAGE_KEYS）
const STORAGE_KEY_BOOKS = 'readmoo_books'
const STORAGE_KEY_TAGS = 'tags'
const STORAGE_KEY_CATEGORIES = 'tag_categories'

describe('UC-04 資料匯入 E2E (W4-001.2)', () => {
  const setup = new ExtensionTestSetup()
  let overviewPage = null
  let setupError = null

  /**
   * 在 SW worker 內讀取 chrome.storage.local 任一 key（單一 key 通用讀取）
   *
   * storage-reader.js 的 readBooksFromStorage 僅讀 readmoo_books 並做書陣列容錯；
   * UC-04 另需讀 tags / tag_categories 兩 key 驗證合併結果，故在本檔提供通用讀取
   * helper（不修改既有 storage-reader，遵守 ticket 約束「不改既有測試/helper」）。
   *
   * @param {string} key - storage key
   * @returns {Promise<any>} key 對應值；不存在時回傳 null
   */
  async function readStorageKey (key) {
    const worker = await getServiceWorker(setup.browser)
    return worker.evaluate((k) => {
      return new Promise(resolve => {
        chrome.storage.local.get([k], result => resolve(result[k] === undefined ? null : result[k]))
      })
    }, key)
  }

  /**
   * 讀取 storage 書籍陣列（雙形態容錯：物件含 .books / 直接陣列）
   *
   * 與 storage-reader.readBooksFromStorage 同容錯邏輯；本檔自帶以避免引入
   * 僅讀 readmoo_books 的限定 helper，保持三 key 讀取一致由 readStorageKey 完成。
   *
   * @returns {Promise<Array>} 書籍物件陣列；無資料時回傳空陣列
   */
  async function readBooks () {
    const raw = await readStorageKey(STORAGE_KEY_BOOKS)
    if (raw === null || raw === undefined) return []
    if (Array.isArray(raw)) return raw
    if (Array.isArray(raw.books)) return raw.books
    return []
  }

  /**
   * polling 等待 storage 書數達到期望值
   *
   * 匯入持久化為 async（讀 storage + 合併計算 + 原子寫回三 key）。用 polling 取代
   * 固定 sleep（test-assertion-design-rules：禁止 setTimeout 固定等待）。
   *
   * @param {number} expectedCount - 期望書數
   * @param {number} [timeout=DEFAULT_NAV_TIMEOUT] - 逾時毫秒數
   * @param {number} [interval=300] - polling 間隔
   * @returns {Promise<Array>} 達期望數量的書籍陣列
   * @throws {Error} 逾時未達期望數量時拋錯（[SETUP] 前綴）
   */
  async function waitForBookCount (expectedCount, timeout = DEFAULT_NAV_TIMEOUT, interval = 300) {
    const deadline = Date.now() + timeout
    let lastCount = -1
    while (Date.now() < deadline) {
      const books = await readBooks()
      lastCount = books.length
      if (books.length === expectedCount) {
        return books
      }
      await new Promise(resolve => setTimeout(resolve, interval))
    }
    throw new Error(
      `[SETUP] storage 未在 ${timeout}ms 內達到 ${expectedCount} 本書（最後一次讀取為 ${lastCount} 本）`
    )
  }

  /**
   * 清空 chrome.storage.local 三個匯入相關 key（books / tags / tag_categories）
   *
   * clearBooksStorage 僅清 readmoo_books；UC-04 匯入會寫 tags / tag_categories，
   * 故每次匯入前另清這兩 key，確保 v1 / v2 案例從乾淨狀態開始（避免前案例殘留
   * 污染合併結果斷言）。
   *
   * @returns {Promise<void>}
   */
  async function clearAllImportStorage () {
    await clearBooksStorage(setup.browser)
    const worker = await getServiceWorker(setup.browser)
    await worker.evaluate((keys) => {
      return new Promise(resolve => {
        chrome.storage.local.remove(keys, () => resolve())
      })
    }, [STORAGE_KEY_TAGS, STORAGE_KEY_CATEGORIES])
  }

  /**
   * 注入 fixture 檔案並以指定模式完成一次匯入
   *
   * 完整真實鏈路：
   * 1. 確保 #fileUploader 可見（#loadFileBtn 須可見才能 click）
   * 2. elementHandle.uploadFile 注入 fixture 至 #jsonFileInput（替換 OS 檔案對話框選檔）
   * 3. click #loadFileBtn -> handleFileLoad -> ImportFlowController.execute
   * 4. execute 內 validate 通過後彈出模式 modal -> click 對應模式按鈕 resolve
   * 5. 模式分流持久化（replaceAllData / mergeAllData），caller 端 poll storage 等待完成
   *
   * 設計考量（多次匯入冪等）：
   * - #importJSONBtn 的事件監聽器為「toggle」#fileUploader 顯示（display 'none' <-> 'block'），
   *   多次匯入若每次 click #importJSONBtn 會在「顯示/隱藏」間擺盪，第二次匯入時把
   *   uploader 切回隱藏導致 #loadFileBtn not clickable（W4-001.2 spike 實證）。
   * - 改為直接以 evaluate 設定 #fileUploader display='block' 確保冪等可見。此操作僅
   *   還原 UI 可見性（toggle 按鈕為 UX 便利入口），不繞過任何匯入業務邏輯——真實匯入
   *   仍經 #loadFileBtn click -> handleFileLoad 全鏈。
   *
   * @param {import('puppeteer').Page} page - overview page
   * @param {string} fixturePath - fixture 檔案絕對路徑
   * @param {'overwrite' | 'merge'} mode - 匯入模式（對應 modal 按鈕）
   * @returns {Promise<void>}
   * @throws {Error} #jsonFileInput 不存在或 modal 按鈕未出現時拋錯（[SETUP] 前綴）
   */
  async function importFixture (page, fixturePath, mode) {
    // 步驟 1：確保檔案上傳區可見（冪等，避免 toggle 擺盪；#loadFileBtn 在 #fileUploader 內）
    await page.waitForSelector('#fileUploader', { timeout: DEFAULT_NAV_TIMEOUT })
    await page.evaluate(() => {
      const uploader = document.getElementById('fileUploader')
      if (uploader) uploader.style.display = 'block'
    })
    await page.waitForSelector('#jsonFileInput', { timeout: DEFAULT_NAV_TIMEOUT })

    // 步驟 2：注入 fixture 至 file input（取代 OS 檔案對話框）
    const fileInput = await page.$('#jsonFileInput')
    if (!fileInput) {
      throw new Error('[SETUP] 找不到 #jsonFileInput，無法注入 fixture 檔案')
    }
    await fileInput.uploadFile(fixturePath)

    // 步驟 3：真實 click #loadFileBtn 觸發匯入流程（讀 input.files[0] -> handleFileLoad）
    await page.click('#loadFileBtn')

    // 步驟 4：等待模式選擇 modal 顯示後 click 對應模式按鈕
    const modeBtnId = mode === 'overwrite' ? 'importModeOverwriteBtn' : 'importModeMergeBtn'
    await page.waitForSelector('#importModeOverlay', { visible: true, timeout: DEFAULT_NAV_TIMEOUT })
    await page.click(`#${modeBtnId}`)

    // 步驟 5：等待 modal 收斂（持久化前 modal 已 hide），持久化完成由 caller poll storage 確認
    await page.waitForSelector('#importModeOverlay', { hidden: true, timeout: DEFAULT_NAV_TIMEOUT })
  }

  beforeAll(async () => {
    try {
      await setup.setup()
      await clearAllImportStorage()

      // 開啟 overview 頁（空 storage 起始，無預設書列）
      overviewPage = await setup.browser.newPage()

      // 安全網：自動關閉任何 dialog（alert/confirm），避免匯入錯誤路徑的 alert
      // 阻塞 Puppeteer 而 hang。預期成功路徑不觸發 dialog。
      overviewPage.on('dialog', async dialog => {
        try { await dialog.dismiss() } catch (_) { /* dialog 已關閉 */ }
      })

      const overviewUrl = `chrome-extension://${setup.extensionId}/src/overview/overview.html`
      await overviewPage.goto(overviewUrl, {
        waitUntil: 'domcontentloaded',
        timeout: DEFAULT_NAV_TIMEOUT
      })

      // 等待 OverviewPageController 初始化完成（window.overviewPage.controller() 就緒）
      // overview.js 於 DOMContentLoaded 後 expose window.overviewPage，controller 為
      // 匯入入口的承載者。等待其就緒以確保 #loadFileBtn 事件監聽器已綁定。
      await overviewPage.waitForFunction(
        () => typeof window.overviewPage === 'object' &&
              typeof window.overviewPage.controller === 'function' &&
              window.overviewPage.controller() !== null,
        { timeout: DEFAULT_NAV_TIMEOUT }
      )
      // 匯入按鈕監聽器綁定確認（importJSONBtn / loadFileBtn 須存在於 DOM）
      await overviewPage.waitForSelector('#importJSONBtn', { timeout: DEFAULT_NAV_TIMEOUT })
      await overviewPage.waitForSelector('#loadFileBtn', { timeout: DEFAULT_NAV_TIMEOUT })
    } catch (error) {
      setupError = error
    }
  }, JEST_TEST_TIMEOUT)

  afterAll(async () => {
    if (overviewPage) {
      try { await overviewPage.close() } catch (_) { /* overview 已關閉 */ }
    }
    // cleanup 以 timeout race 包裹：browser.close() 在多 Chrome instance 連續啟動的
    // 全套件情境下偶爾 hang（headed Chrome 資源競爭），程序退出時 Chrome 仍會被回收。
    const CLEANUP_TIMEOUT = 15000
    await Promise.race([
      setup.cleanup(),
      new Promise(resolve => setTimeout(resolve, CLEANUP_TIMEOUT))
    ])
  }, JEST_TEST_TIMEOUT)

  /**
   * 確保 beforeAll setup 未失敗；失敗以 [SETUP] 前綴拋出，
   * 使 RED 驗證能區分環境故障與匯入 regression。
   */
  function assertSetupSucceeded () {
    if (setupError) {
      throw new Error(`[SETUP] beforeAll 前置失敗，無法執行斷言: ${setupError.message}`)
    }
  }

  // ========== G1：UC-04 v1 格式匯入自動轉換（acceptance #1）==========

  describe('G1 UC-04 v1 格式匯入自動轉換', () => {
    let importedBooks = []
    let importedTags = []
    let importError = null

    beforeAll(async () => {
      if (setupError) return
      try {
        await clearAllImportStorage()
        // v1 匯入採覆蓋模式（空書庫起始，覆蓋語意等同清空後載入）
        await importFixture(overviewPage, FIXTURE_V1, 'overwrite')
        // sample-v1.json 含 2 本書，等待轉換 + 持久化完成
        importedBooks = await waitForBookCount(2)
        importedTags = await readStorageKey(STORAGE_KEY_TAGS) || []
      } catch (error) {
        importError = error
      }
    }, JEST_TEST_TIMEOUT)

    test('[SETUP] G1-1 v1 匯入後 storage 寫入 2 本書', () => {
      assertSetupSucceeded()
      if (importError) throw new Error(`[SETUP] v1 匯入前置失敗: ${importError.message}`)
      expect(importedBooks.length).toBe(2)
    })

    test('[V1] G1-2 每本書 readingStatus 為 6 狀態合法值（isNew/isFinished 已轉換）', () => {
      assertSetupSucceeded()
      if (importError) throw new Error(`[SETUP] v1 匯入前置失敗: ${importError.message}`)
      importedBooks.forEach(book => {
        expect(typeof book.id).toBe('string')
        expect(book.id.length).toBeGreaterThan(0)
        expect(typeof book.title).toBe('string')
        expect(book.title.length).toBeGreaterThan(0)
        // v1 轉換後 readingStatus 必為 6 狀態 enum 合法成員（BookSchemaV2.mapV1StatusToV2）
        expect(READING_STATUS_ENUM).toContain(book.readingStatus)
        // v1 書原無 readingStatus / isNew / isFinished 殘留（已轉換為 readingStatus）
        expect(Object.prototype.hasOwnProperty.call(book, 'isNew')).toBe(false)
        expect(Object.prototype.hasOwnProperty.call(book, 'isFinished')).toBe(false)
      })
    })

    test('[V1] G1-3 isFinished=true 之書轉為 finished、進行中之書轉為 reading', () => {
      assertSetupSucceeded()
      if (importError) throw new Error(`[SETUP] v1 匯入前置失敗: ${importError.message}`)
      // sample-v1.json：book-1 isFinished=true -> finished；book-2 isFinished=false progress=30 -> reading
      const bookFinished = importedBooks.find(b => b.id === 'uc04-v1-book-1')
      const bookReading = importedBooks.find(b => b.id === 'uc04-v1-book-2')
      expect(bookFinished).toBeDefined()
      expect(bookReading).toBeDefined()
      expect(bookFinished.readingStatus).toBe('finished')
      expect(bookReading.readingStatus).toBe('reading')
    })

    test('[V1] G1-4 每本書 tagIds 恆為陣列（INV-1：v1 轉換不得回傳 undefined/null）', () => {
      assertSetupSucceeded()
      if (importError) throw new Error(`[SETUP] v1 匯入前置失敗: ${importError.message}`)
      importedBooks.forEach(book => {
        expect(Object.prototype.hasOwnProperty.call(book, 'tagIds')).toBe(true)
        expect(Array.isArray(book.tagIds)).toBe(true)
      })
    })

    test('[V1] G1-5 v1 category 轉為 tag，書 tagIds 指向有效 tag', () => {
      assertSetupSucceeded()
      if (importError) throw new Error(`[SETUP] v1 匯入前置失敗: ${importError.message}`)
      // sample-v1.json 兩本書 category 皆為「V1匯入分類」，v1-to-v2-converter 應建立對應 tag。
      // 驗證 tag 存在且書的 tagIds 全部指向實際存在的 tag（引用完整性）。
      expect(Array.isArray(importedTags)).toBe(true)
      expect(importedTags.length).toBeGreaterThanOrEqual(1)
      const validTagIds = new Set(importedTags.map(t => t.id))
      importedBooks.forEach(book => {
        book.tagIds.forEach(tid => {
          expect(validTagIds.has(tid)).toBe(true)
        })
      })
      // 至少一本書帶有 tag（category 轉換生效，非空集合）
      const booksWithTag = importedBooks.filter(b => b.tagIds.length > 0)
      expect(booksWithTag.length).toBeGreaterThanOrEqual(1)
    })
  })

  // ========== G2：UC-04 v2 格式匯入 + 合併（acceptance #2）==========

  describe('G2 UC-04 v2 合併模式 tag 聯集 + 去重', () => {
    let mergedBooks = []
    let mergedTags = []
    let baseImportError = null
    let mergeImportError = null

    beforeAll(async () => {
      if (setupError) return
      try {
        // 清乾淨後先以覆蓋模式載入 base（建立合併目標的初始狀態）
        await clearAllImportStorage()
        await importFixture(overviewPage, FIXTURE_V2_BASE, 'overwrite')
        await waitForBookCount(2) // sample-v2-base 含 2 本書（uc04-book-x / uc04-book-y）
      } catch (error) {
        baseImportError = error
        return
      }
      try {
        // 再以合併模式載入 merge（uc04-book-x 同 id 不同 tag，預期 tagIds 聯集）
        await importFixture(overviewPage, FIXTURE_V2_MERGE, 'merge')
        // 合併後書數仍為 2（x 同 id 去重不複製、y 原樣保留）
        mergedBooks = await waitForBookCount(2)
        mergedTags = await readStorageKey(STORAGE_KEY_TAGS) || []
      } catch (error) {
        mergeImportError = error
      }
    }, JEST_TEST_TIMEOUT)

    test('[SETUP] G2-1 base + merge 匯入前置完成', () => {
      assertSetupSucceeded()
      if (baseImportError) throw new Error(`[SETUP] base 匯入失敗: ${baseImportError.message}`)
      if (mergeImportError) throw new Error(`[SETUP] merge 匯入失敗: ${mergeImportError.message}`)
      expect(mergedBooks.length).toBe(2)
    })

    test('[MERGE] G2-2 合併後書數恆 2（同 id 去重不複製、本地書原樣保留）', () => {
      assertSetupSucceeded()
      if (baseImportError || mergeImportError) {
        throw new Error('[SETUP] 合併匯入前置失敗，無法驗證去重')
      }
      // 去重驗證：合併後 book id 集合無重複，且兩本書 id 為 x / y
      const ids = mergedBooks.map(b => b.id)
      const uniqueIds = new Set(ids)
      expect(uniqueIds.size).toBe(ids.length) // 無重複 id
      expect(uniqueIds.has('uc04-book-x')).toBe(true)
      expect(uniqueIds.has('uc04-book-y')).toBe(true)
    })

    test('[MERGE] G2-3 同 id 書 tagIds 取聯集（base 科幻 + merge 推理 = 2 個）', () => {
      assertSetupSucceeded()
      if (baseImportError || mergeImportError) {
        throw new Error('[SETUP] 合併匯入前置失敗，無法驗證 tag 聯集')
      }
      const bookX = mergedBooks.find(b => b.id === 'uc04-book-x')
      expect(bookX).toBeDefined()
      expect(Array.isArray(bookX.tagIds)).toBe(true)
      // base 帶 1 tag（科幻），merge 帶 1 新 tag（推理）；聯集後 2 個且去重無重複
      expect(bookX.tagIds.length).toBe(2)
      expect(new Set(bookX.tagIds).size).toBe(2)
      // 聯集 tagIds 全部指向 storage 中實際存在的 tag（引用完整性）
      const validTagIds = new Set(mergedTags.map(t => t.id))
      bookX.tagIds.forEach(tid => {
        expect(validTagIds.has(tid)).toBe(true)
      })
      // 聯集後本地原 tag（科幻）與合併新 tag（推理）對應名稱皆存在
      const tagNames = new Set(
        bookX.tagIds.map(tid => (mergedTags.find(t => t.id === tid) || {}).name)
      )
      expect(tagNames.has('科幻')).toBe(true)
      expect(tagNames.has('推理')).toBe(true)
    })

    test('[MERGE] G2-4 未涉合併的本地書 tagIds 原樣保留（uc04-book-y 維持 1 個 tag）', () => {
      assertSetupSucceeded()
      if (baseImportError || mergeImportError) {
        throw new Error('[SETUP] 合併匯入前置失敗，無法驗證本地書保留')
      }
      const bookY = mergedBooks.find(b => b.id === 'uc04-book-y')
      expect(bookY).toBeDefined()
      expect(Array.isArray(bookY.tagIds)).toBe(true)
      // merge fixture 未含 uc04-book-y，合併不刪除、不改本地，tagIds 維持 base 的 1 個（文學）
      expect(bookY.tagIds.length).toBe(1)
      const yTag = mergedTags.find(t => t.id === bookY.tagIds[0])
      expect(yTag).toBeDefined()
      expect(yTag.name).toBe('文學')
    })

    test('[MERGE] G2-5 tags 總數為 3（科幻 + 文學 base，推理為合併新建）', () => {
      assertSetupSucceeded()
      if (baseImportError || mergeImportError) {
        throw new Error('[SETUP] 合併匯入前置失敗，無法驗證 tag 總數')
      }
      expect(Array.isArray(mergedTags)).toBe(true)
      // base 帶 2 tag（科幻 / 文學），merge 帶 1 tag（推理，同 category 不同名 -> 新建）
      expect(mergedTags.length).toBe(3)
      const names = new Set(mergedTags.map(t => t.name))
      expect(names.has('科幻')).toBe(true)
      expect(names.has('文學')).toBe(true)
      expect(names.has('推理')).toBe(true)
    })
  })
})
