/**
 * extraction-pipeline.e2e.test.js — 提取-儲存-顯示 pipeline 真實瀏覽器 E2E 測試
 *
 * 負責功能（W1-008）：
 * - 在真實 Chrome + 已載入 Extension 環境下，驗證提取-儲存-顯示完整 pipeline
 * - 斷言提取書物件符合 v1.1 model（readingStatus 為 6 狀態 enum 合法成員、tagIds 為陣列）
 * - 連續 2 次提取去重 regression 鎖定
 * - Overview 頁面顯示 regression 鎖定
 *
 * 測試定位（§3.5 B1）：
 * - regression 鎖定測試 — 驗證 W1-009 model 轉換修復在真實瀏覽器環境持續有效。
 * - 常態為 GREEN。一次性 RED 驗證（暫時 revert event-coordinator.js model 轉換層）
 *   證明測試確實能偵測 model gap regression，避免寫出永遠通過的假測試。
 *
 * 測試結構分層（M6 物理分離）：
 * - [SETUP]   前綴：環境問題（Extension 載入、SW 註冊、fixture 導航、提取觸發）
 * - [MODEL]   前綴：model regression（readingStatus / tagIds 缺失）
 * - [DEDUP]   前綴：去重行為 regression
 * - [DISPLAY] 前綴：Overview 顯示 regression
 * 一次性 RED 驗證時，失敗訊息含 [SETUP] 須先排除環境故障；含 [MODEL] 才確認為 model gap。
 *
 * 執行方式：npm run test:e2e:browser（CI: xvfb-run -a npm run test:e2e:browser）
 * 前置：須先 npm run build:dev 產出 build/development（Extension 載入路徑）
 */

const ExtensionTestSetup = require('../setup/extension-setup')
const { clearBooksStorage } = require('./helpers/storage-reader')
const {
  FIXTURE_BOOK_COUNT,
  runExtraction,
  reExtract
} = require('./helpers/extraction-flow')
const {
  DEFAULT_NAV_TIMEOUT,
  OVERVIEW_RENDER_TIMEOUT,
  JEST_TEST_TIMEOUT
} = require('./helpers/timeouts')

// v1.1 model readingStatus 6 狀態 enum
const READING_STATUS_ENUM = ['unread', 'reading', 'finished', 'queued', 'abandoned', 'reference']

// 自動 derive 可產生的狀態子集（首次提取只能 derive 這 3 種）
const DERIVABLE_STATUS = ['unread', 'reading', 'finished']

// fixture 5 本書的書名（與 readmoo-mock-page.html 一致）
const FIXTURE_TITLES = ['測試書籍一', '測試書籍二', '測試書籍三', '測試書籍四', '測試書籍五']

// fixture 書籍 progress -> 期望 readingStatus（自動 derive 正確性對照）
const PROGRESS_TO_STATUS = {
  0: 'unread',
  1: 'reading',
  45: 'reading',
  99: 'reading',
  100: 'finished'
}

describe('提取-儲存-顯示 pipeline E2E (W1-008)', () => {
  const setup = new ExtensionTestSetup()
  let sharedBooks = []
  let sharedJsErrors = []
  let setupError = null

  // L-A setup 前置：Extension 載入 + 一次提取，結果供 G2/G3/G5 共用
  beforeAll(async () => {
    try {
      await setup.setup()
      await clearBooksStorage(setup.browser)
      const result = await runExtraction(setup)
      sharedBooks = result.books
      sharedJsErrors = result.jsErrors
    } catch (error) {
      // 保留 setup 錯誤，於各 test 中以 [SETUP] 前綴顯性呈現
      setupError = error
    }
  }, JEST_TEST_TIMEOUT)

  afterAll(async () => {
    await setup.cleanup()
  })

  /**
   * 確保 beforeAll 的 setup 未失敗；失敗則以 [SETUP] 前綴拋出，
   * 使一次性 RED 驗證能區分 setup 故障與 model regression。
   */
  function assertSetupSucceeded () {
    if (setupError) {
      throw new Error(`[SETUP] beforeAll 前置失敗，無法執行斷言: ${setupError.message}`)
    }
  }

  // ========== G1：Extension 載入與 SW 註冊（setup 前置驗證 — L-A）==========

  describe('G1 Extension 載入與環境就緒', () => {
    test('[SETUP] G1-1 Extension 成功載入且 Service Worker 註冊', () => {
      assertSetupSucceeded()
      expect(typeof setup.extensionId).toBe('string')
      expect(setup.extensionId.length).toBeGreaterThan(0)
    })

    test('[SETUP] G1-2 fixture 導航成功且含正好 5 本書', async () => {
      assertSetupSucceeded()
      const libraryItemCount = await setup.page.$$eval('.library-item', els => els.length)
      expect(libraryItemCount).toBe(FIXTURE_BOOK_COUNT)
    })
  })

  // ========== G2：提取 pipeline 主流程（UC-01，§3.1 S1-S5）==========

  describe('G2 提取 pipeline 主流程 (UC-01)', () => {
    test('[SETUP] G2-1 提取後 storage 寫入 5 本書且無 JS error', () => {
      assertSetupSucceeded()
      expect(sharedJsErrors).toEqual([])
      expect(sharedBooks.length).toBe(FIXTURE_BOOK_COUNT)
    })
  })

  // ========== G3：書物件 v1.1 model 斷言（核心，§3.2，RED 驗證標的）==========

  describe('G3 書物件 v1.1 model 斷言 (核心)', () => {
    test('[MODEL] G3-1 每本書具備 v1.1 model 必填欄位', () => {
      assertSetupSucceeded()
      expect(sharedBooks.length).toBe(FIXTURE_BOOK_COUNT)
      sharedBooks.forEach((book, index) => {
        expect(typeof book.id).toBe('string')
        expect(book.id.length).toBeGreaterThan(0)
        expect(typeof book.title).toBe('string')
        expect(book.title.length).toBeGreaterThan(0)
        expect(typeof book.progress).toBe('number')
        expect(book.progress).toBeGreaterThanOrEqual(0)
        expect(book.progress).toBeLessThanOrEqual(100)
        // v1.1 model 必填：readingStatus 存在且非空
        expect(book.readingStatus).toBeDefined()
        expect(book.readingStatus).not.toBeNull()
        expect(book.readingStatus).not.toBe('')
        // v1.1 model 必填：tagIds 為陣列（首次提取為 []）
        expect(Array.isArray(book.tagIds)).toBe(true)
      })
    })

    test('[MODEL] G3-2 readingStatus 為 6 狀態 enum 合法成員', () => {
      assertSetupSucceeded()
      sharedBooks.forEach(book => {
        expect(READING_STATUS_ENUM).toContain(book.readingStatus)
      })
    })

    test('[MODEL] G3-3 readingStatus 由 progress 自動 derive 正確', () => {
      assertSetupSucceeded()
      sharedBooks.forEach(book => {
        const expectedStatus = PROGRESS_TO_STATUS[book.progress]
        expect(expectedStatus).toBeDefined()
        expect(book.readingStatus).toBe(expectedStatus)
      })
      // 首次提取 derive 結果僅含可 derive 的 3 種狀態
      const derivedStatuses = sharedBooks.map(b => b.readingStatus)
      derivedStatuses.forEach(status => {
        expect(DERIVABLE_STATUS).toContain(status)
      })
    })

    test('[MODEL] G3-4 提取書名與 fixture 一致', () => {
      assertSetupSucceeded()
      const titles = sharedBooks.map(b => b.title).sort()
      expect(titles).toEqual([...FIXTURE_TITLES].sort())
    })
  })

  // ========== G4：去重斷言（UC-02 部分，§3.3，獨立 browser）==========

  describe('G4 連續提取去重 (UC-02)', () => {
    test('[DEDUP] G4-1 連續 2 次提取無重複記錄', async () => {
      const dedupSetup = new ExtensionTestSetup()
      try {
        await dedupSetup.setup()
        await clearBooksStorage(dedupSetup.browser)

        // 第 1 次提取（含 navigateToFixture：interception + console 監聽 + 首次導航）
        const { books: firstBooks } = await runExtraction(dedupSetup)
        expect(firstBooks.length).toBe(FIXTURE_BOOK_COUNT)

        // 第 2 次提取：reExtract 封裝重新導航 + 等待 content script 就緒 + 觸發提取
        const secondBooks = await reExtract(dedupSetup)

        // 書數仍為 5（無重複記錄）
        expect(secondBooks.length).toBe(FIXTURE_BOOK_COUNT)

        // id 唯一性：排除「整批覆寫偽裝去重」（L3）
        const ids = secondBooks.map(b => b.id)
        expect(new Set(ids).size).toBe(ids.length)
      } finally {
        await dedupSetup.cleanup()
      }
    }, JEST_TEST_TIMEOUT)
  })

  // ========== G5：Overview 顯示斷言（UC-06 部分，§3.4）==========

  describe('G5 Overview 顯示 (UC-06)', () => {
    test('[DISPLAY] G5-1 Overview 頁面正確顯示 5 本書書名', async () => {
      assertSetupSucceeded()
      const overviewPage = await setup.browser.newPage()
      try {
        const overviewUrl = `chrome-extension://${setup.extensionId}/src/overview/overview.html`
        await overviewPage.goto(overviewUrl, { waitUntil: 'domcontentloaded', timeout: DEFAULT_NAV_TIMEOUT })

        // 等待書籍清單渲染完成（#tableBody 至少一列 tr）
        await overviewPage.waitForSelector('#tableBody tr', { timeout: DEFAULT_NAV_TIMEOUT })

        // 書名 cell 以語意化 class 定位，避免位置選擇器隨欄位順序變動失效
        const titles = await overviewPage.$$eval(
          '#tableBody tr td.book-title-cell',
          tds => tds.map(td => td.textContent.trim())
        )

        expect(titles.length).toBe(FIXTURE_BOOK_COUNT)
        expect([...titles].sort()).toEqual([...FIXTURE_TITLES].sort())
      } finally {
        await overviewPage.close()
      }
    }, OVERVIEW_RENDER_TIMEOUT)
  })
})
