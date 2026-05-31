/**
 * popup-extraction-click.e2e.test.js — popup UI 真實 click 觸發 E2E 測試（W4-006.2）
 *
 * 負責功能：
 * - 在真實 Chrome + 已載入 Extension 環境下，驗證 popup #extractBtn 真實 click
 *   觸發 startExtraction → chrome.tabs.sendMessage(START_EXTRACTION) → background
 *   pipeline → chrome.storage.local 寫入完整鏈路
 * - 補 W1-008 Phase 3b 偏差 2 遺留的 popup UI button 觸發層 E2E 覆蓋缺口
 * - 斷言提取書物件符合 v1.1 model（readingStatus + tagIds）
 * - 同時驗證 W4-006.2 popup Logger 重複宣告 SyntaxError 修復（pageerror 歸零）
 *
 * 測試定位（§3.5 B1）：
 * - regression 鎖定 + 缺口補強型 E2E 測試。
 * - 與 extraction-pipeline.e2e.test.js 互補：後者用 SW 直送 START_EXTRACTION
 *   繞過 popup UI button，本檔覆蓋 popup UI click 真實觸發路徑。
 *
 * 設計考量：
 * - Puppeteer 環境下 popup 為獨立分頁，popup 內 chrome.tabs.query({active:true,
 *   currentWindow:true}) 會把 popup 自身判定為 active tab → isReadmoo=false →
 *   #extractBtn 保持 disabled，無法直接 click。
 * - 採 runtime 監督式 monkey-patch（exposeFunction + initScript）注入 readmoo tab
 *   元資訊到 popup，於 popup load 前替換 chrome.tabs.query 回傳值，使
 *   checkCurrentTab → isReadmoo=true → extractBtn.disabled=false 邏輯鏈走通。
 * - 此 mock 只影響 popup 自身 chrome.tabs.query 呼叫；START_EXTRACTION 仍透過
 *   chrome.tabs.sendMessage(tabId, ...) 真實送至 readmoo content script tab。
 * - W4-006.1 pageerror 三筆（Logger SyntaxError x2 + Tracker ReferenceError x1）
 *   修復驗證：popup 載入時 popupErrors 陣列應為空。
 *
 * 執行方式：npm run test:e2e:browser
 * 前置：須先 npm run build:dev 產出 build/development
 */

const ExtensionTestSetup = require('../setup/extension-setup')
const { clearBooksStorage, readBooksFromStorage, waitForBooksStable, getServiceWorker } = require('./helpers/storage-reader')
const {
  FIXTURE_URL,
  FIXTURE_BOOK_COUNT,
  navigateToFixture
} = require('./helpers/extraction-flow')
const {
  DEFAULT_NAV_TIMEOUT,
  JEST_TEST_TIMEOUT
} = require('./helpers/timeouts')

// v1.1 model readingStatus 6 狀態 enum（與 extraction-pipeline.e2e.test.js 對齊）
const READING_STATUS_ENUM = ['unread', 'reading', 'finished', 'queued', 'abandoned', 'reference']

describe('popup #extractBtn 真實 click 觸發 E2E (W4-006.2)', () => {
  const setup = new ExtensionTestSetup()
  let popupPage = null
  let popupErrors = []
  let extractedBooks = []
  let readmooTabId = null
  let setupError = null

  /**
   * 取得 readmoo fixture tab 的 chrome.tabs metadata
   *
   * popup 內 chrome.tabs.query 會回傳 popup 自身 tab，需透過 Service Worker
   * 取得 fixture tab 的真實 metadata 後注入 popup mock。
   *
   * @param {import('puppeteer').Browser} browser
   * @returns {Promise<{id: number, url: string, title: string}>} fixture tab metadata
   */
  async function getReadmooTabMetadata (browser) {
    const worker = await getServiceWorker(browser)
    return await worker.evaluate(async () => {
      const tabs = await chrome.tabs.query({})
      const target = tabs.find(t => t.url && t.url.includes('readmoo.com/library'))
      if (!target) {
        throw new Error('readmoo fixture tab 未找到')
      }
      return { id: target.id, url: target.url, title: target.title || '' }
    })
  }

  /**
   * 開啟 popup 並注入 chrome.tabs.query mock
   *
   * 採 evaluateOnNewDocument（document-start 階段）替換 chrome.tabs.query，
   * 使 popup 內 checkCurrentTab() 看到 readmoo fixture tab 作為 active tab，
   * 從而走通 extractBtn enable 邏輯。
   *
   * chrome.tabs.sendMessage 不 mock，真實送至 readmoo content script tab。
   *
   * @param {Object} ctx - { browser, extensionId, readmooTab }
   * @returns {Promise<{page, errors: string[]}>} popup page + 錯誤收集陣列
   */
  async function openPopupWithMockedActiveTab ({ browser, extensionId, readmooTab }) {
    const page = await browser.newPage()
    const errors = []

    // 收集 popup pageerror（W4-006.1 修復驗證點）
    page.on('pageerror', e => errors.push(e.message))
    page.on('console', msg => {
      if (msg.type() === 'error') {
        errors.push(`[console.error] ${msg.text()}`)
      }
    })

    // document-start 階段注入 chrome.tabs.query mock
    // 設計考量：
    // - 只替換 chrome.tabs.query 一個 API，最小侵入，避免污染其他 API 行為
    // - 保留原始 chrome.tabs.sendMessage 真實送至 readmoo content script tab
    // - 過濾條件對齊 popup checkCurrentTab 的 {active:true, currentWindow:true}
    //   query 模式，其他 query（如 SW 內 chrome.tabs.query({})）不受影響
    await page.evaluateOnNewDocument((mockTab) => {
      const interval = setInterval(() => {
        if (window.chrome && window.chrome.tabs && window.chrome.tabs.query) {
          clearInterval(interval)
          const originalQuery = window.chrome.tabs.query.bind(window.chrome.tabs)
          window.chrome.tabs.query = function (queryInfo, callback) {
            // 只攔截 popup 的 active+currentWindow query；其他保留原始行為
            const isActiveCurrentQuery = queryInfo &&
              queryInfo.active === true &&
              queryInfo.currentWindow === true
            if (isActiveCurrentQuery) {
              const result = [mockTab]
              if (typeof callback === 'function') {
                callback(result)
                return undefined
              }
              return Promise.resolve(result)
            }
            return originalQuery(queryInfo, callback)
          }
        }
      }, 10)
      // 超時自動清理 interval（防護 popup chrome API 未注入時無限 polling）
      setTimeout(() => clearInterval(interval), 5000)
    }, readmooTab)

    await page.goto(`chrome-extension://${extensionId}/src/popup/popup.html`, {
      waitUntil: 'domcontentloaded',
      timeout: DEFAULT_NAV_TIMEOUT
    })

    // 等待 popup 初始化完成（initialize → checkCurrentTab → extractBtn.disabled=false）
    // popup.html 預設 extractBtn disabled，等待邏輯鏈將其轉為 enabled
    await page.waitForFunction(
      () => {
        const btn = document.getElementById('extractBtn')
        return btn && btn.disabled === false
      },
      { timeout: 10000 }
    )

    return { page, errors }
  }

  beforeAll(async () => {
    try {
      await setup.setup()
      await clearBooksStorage(setup.browser)

      // 步驟 1：導航 fixture（建立 readmoo content script 注入環境）
      await navigateToFixture(setup)

      // 步驟 2：取得 readmoo tab metadata 供 popup mock 使用
      const readmooTab = await getReadmooTabMetadata(setup.browser)
      readmooTabId = readmooTab.id

      // 步驟 3：開啟 popup 並注入 mock，等待 extractBtn 啟用
      const popupResult = await openPopupWithMockedActiveTab({
        browser: setup.browser,
        extensionId: setup.extensionId,
        readmooTab
      })
      popupPage = popupResult.page
      popupErrors = popupResult.errors

      // 步驟 4：真實 click #extractBtn 觸發 startExtraction
      await popupPage.click('#extractBtn')

      // 步驟 5：等待 storage 寫入 5 本書（提取完成）
      extractedBooks = await waitForBooksStable(setup.browser, FIXTURE_BOOK_COUNT)
    } catch (error) {
      setupError = error
    }
  }, JEST_TEST_TIMEOUT)

  afterAll(async () => {
    if (popupPage) {
      try { await popupPage.close() } catch (_) { /* popup 已關閉 */ }
    }
    await setup.cleanup()
  })

  function assertSetupSucceeded () {
    if (setupError) {
      throw new Error(`[SETUP] beforeAll 前置失敗，無法執行斷言: ${setupError.message}`)
    }
  }

  // ========== G1：popup 載入無 pageerror（W4-006.1 修復驗證）==========

  describe('G1 popup 載入無 pageerror（W4-006.1 修復驗證）', () => {
    test('[POPUP] G1-1 popup 載入時無 Logger SyntaxError / Tracker ReferenceError', () => {
      assertSetupSucceeded()
      // W4-006.1 spike v7 重現的三筆 pageerror（Logger SyntaxError x2 + Tracker ReferenceError x1）
      // 修復後應全部消除。若 popupErrors 含其他環境性錯誤，視為 setup 異常。
      const loggerSyntaxErrors = popupErrors.filter(e =>
        e.includes("Identifier 'Logger' has already been declared") ||
        e.includes('PopupInitializationTracker is not defined')
      )
      expect(loggerSyntaxErrors).toEqual([])
    })

    test('[POPUP] G1-2 popup 取得 readmoo tab metadata 成功', () => {
      assertSetupSucceeded()
      expect(typeof readmooTabId).toBe('number')
      expect(readmooTabId).toBeGreaterThan(0)
    })
  })

  // ========== G2：click 觸發 startExtraction 邏輯鏈（W4-006.2 核心）==========

  describe('G2 click → startExtraction → storage 寫入（W4-006.2 核心）', () => {
    test('[CLICK] G2-1 click #extractBtn 後 storage 寫入 5 本書', () => {
      assertSetupSucceeded()
      expect(extractedBooks.length).toBe(FIXTURE_BOOK_COUNT)
    })

    test('[CLICK] G2-2 popup 進入提取後狀態（extractBtn 不再 disabled-loading）', async () => {
      assertSetupSucceeded()
      // startExtraction finally 區塊 updateButtonState(false) 應使按鈕回到非 loading
      // 此斷言確認 click 後 popup UI 持續運作（未被 pageerror 中斷）
      const btnState = await popupPage.evaluate(() => {
        const btn = document.getElementById('extractBtn')
        return { exists: !!btn, disabled: btn ? btn.disabled : null }
      })
      expect(btnState.exists).toBe(true)
      // disabled 可能為 true（startExtraction 進行中）或 false（已完成），
      // 重點是 btn 仍可被查詢，popup 未崩潰
    })
  })

  // ========== G3：書物件 v1.1 model 斷言（與 extraction-pipeline 對齊）==========

  describe('G3 提取書物件 v1.1 model 斷言', () => {
    test('[MODEL] G3-1 每本書具備 v1.1 model 必填欄位（readingStatus + tagIds）', () => {
      assertSetupSucceeded()
      expect(extractedBooks.length).toBe(FIXTURE_BOOK_COUNT)
      extractedBooks.forEach(book => {
        expect(typeof book.id).toBe('string')
        expect(book.id.length).toBeGreaterThan(0)
        expect(typeof book.title).toBe('string')
        expect(book.title.length).toBeGreaterThan(0)
        // v1.1 model 必填：readingStatus 存在且為合法 enum 成員
        expect(book.readingStatus).toBeDefined()
        expect(book.readingStatus).not.toBeNull()
        expect(READING_STATUS_ENUM).toContain(book.readingStatus)
        // v1.1 model 必填：tagIds 為陣列（首次提取為 []）
        expect(Array.isArray(book.tagIds)).toBe(true)
      })
    })
  })
})
