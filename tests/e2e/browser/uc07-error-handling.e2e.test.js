/**
 * uc07-error-handling.e2e.test.js — UC-07 錯誤處理真實瀏覽器 E2E regression 測試（W4-001.3）
 *
 * 負責功能：
 * - 在真實 Chrome + 已載入 Extension 環境下，驗證 UC-07 錯誤場景的「優雅降級」
 *   不因後續重構而回歸（quality-baseline 規則 5：補自動化 regression 防護）。
 * - 涵蓋三類 E2E 可測的錯誤場景（規格依據 docs/use-cases.md L365-446）：
 *   * 場景 B（Readmoo DOM 結構變更）：mutated fixture 使既有 selector 全失效 →
 *     提取 0 本書，系統不崩潰、storage 不被污染（優雅降級）。
 *   * 場景 C（檔案匯入格式錯誤）：malformed JSON（語法損壞 / 結構不符）匯入 →
 *     顯示格式錯誤訊息、不崩潰、storage 不被污染。
 *   * 場景 D/G（儲存配額不足）：覆寫 getBytesInUse 使配額達 blocked 門檻（>=95%）→
 *     匯入合法檔案被配額閘攔截，顯示「儲存空間不足」訊息、storage 不被寫入。
 *
 * 測試定位（regression 鎖定型 E2E）：
 * - 常態 GREEN，鎖定「錯誤路徑優雅降級」契約不回歸（如改成崩潰、錯誤訊息消失、
 *   錯誤資料被寫進 storage）。
 * - 與 uc03-export / uc04-import 互補：前兩者覆蓋成功路徑（匯出 / 匯入下游），
 *   本檔覆蓋失敗路徑的降級行為。
 *
 * 測試結構分層（前綴揭露失敗性質）：
 * - [SETUP]    前綴：環境 / overview 載入 / 提取觸發等前置失敗（非 regression）
 * - [DEGRADE]  前綴：場景 B DOM 變更優雅降級 regression（提取 0 本不崩潰）
 * - [IMPORT]   前綴：場景 C 匯入格式錯誤訊息 regression
 * - [QUOTA]    前綴：場景 D/G 配額不足攔截 regression
 *
 * 場景 B 設計考量（mutated DOM）：
 * - extraction-flow.js helper 硬編碼正常 fixture（readmoo-mock-page.html）且 poll
 *   固定 5 本書，無法用於「期望 0 本」場景；故本檔在 G1 自帶 mutated fixture 的
 *   request interception（讀本檔專屬 mutated fixture），不修改既有 helper。
 * - START_EXTRACTION 為 async flow（content-modular.js 即時回 success+flowId，
 *   實際 DOM 解析在 flow 內進行，結果落 storage）。故降級驗證採「bounded poll」：
 *   在一段時間窗內持續確認 storage 維持 0 本（不被寫入錯誤資料），而非等待達標。
 * - 「不崩潰」以 page pageerror 監聽 + SW PING 存活確認雙重斷言（DOM 解析失敗
 *   不應使 content script 或 SW 死亡）。
 *
 * 場景 C 設計考量（malformed JSON 匯入）：
 * - 採與 uc04-import 相同的真實匯入鏈：注入 fixture 至 #jsonFileInput → click
 *   #loadFileBtn → handleFileLoad → ImportFlowController.execute → modal 選模式 →
 *   bookFileImporter.read → ContentParser.parse 拋 PARSE_ERROR / VALIDATION_ERROR。
 *   FileContentReader._handleSuccess 在 parse 拋錯時先呼叫 showError 再 reject，
 *   showError 接線至 controller.showError → #errorContainer 顯示 + #errorMessage 文字。
 * - 兩個 fixture 覆蓋兩條錯誤路徑：
 *   * malformed-broken-syntax.json：JSON.parse 失敗 → PARSE_ERROR（「JSON 檔案格式不正確」）
 *   * structurally-invalid.json：JSON 合法但非陣列且無 books → VALIDATION_ERROR
 *     （「JSON 檔案應該包含一個陣列或包含books屬性的物件」）
 * - 兩 fixture 皆為 .json 副檔名，故通過 FileValidator.validate（格式檢查），確保
 *   錯誤發生在「解析階段」而非「格式階段」，精準鎖定 read/parse 降級契約。
 *
 * 場景 D/G 設計考量（儲存配額不足）：
 * - 配額閘為真實生產碼：TagStorageAdapter.replaceAllData/mergeAllData 寫入前呼叫
 *   checkQuotaLevel()，其讀 chrome.storage.local.getBytesInUse(null) / MAX_STORAGE_SIZE
 *   (5MB)，usageRatio >= 0.95 時回 { success:false, error:'quota_exceeded' }，
 *   ImportFlowController.execute 將其轉為 showError('儲存空間不足，匯入未完成')。
 * - 不真的塞滿 5MB（脆弱、慢）；改在 overview page context 覆寫
 *   chrome.storage.local.getBytesInUse 回傳 >= 95% * 5MB 的 bytes 數，命中真實
 *   配額閘判斷分支。覆寫僅替換「用量量測來源」一步，不繞過任何配額決策業務邏輯。
 * - 驗證：錯誤訊息顯示 + storage 未被寫入（配額閘在持久化前攔截）。測試後還原
 *   getBytesInUse 避免污染後續測試（本檔 D/G 為最後一組，仍還原以策安全）。
 *
 * 受測 src 唯讀：本檔僅新增測試與 fixtures，未改任何 src 與既有測試/helper。
 *
 * 執行方式：npm run test:e2e:browser（npm run test:e2e 以 testPathIgnorePatterns
 *   排除 browser/，本檔須用 test:e2e:browser）
 * 前置：須先 npm run build:dev 產出 build/development（Extension 載入路徑）
 */

const fs = require('fs')
const path = require('path')
const ExtensionTestSetup = require('../setup/extension-setup')
const {
  clearBooksStorage,
  getServiceWorker,
  readBooksFromStorage
} = require('./helpers/storage-reader')
const {
  FIXTURE_URL,
  waitForContentScriptReady
} = require('./helpers/extraction-flow')
const {
  DEFAULT_NAV_TIMEOUT,
  JEST_TEST_TIMEOUT
} = require('./helpers/timeouts')

// UC-07 錯誤場景 fixture 絕對路徑（本檔專屬，置於 tests/e2e/fixtures/uc07-error/）
const FIXTURE_DIR = path.resolve(__dirname, '../fixtures/uc07-error')
const FIXTURE_MUTATED_HTML = path.join(FIXTURE_DIR, 'readmoo-mutated-page.html')
const FIXTURE_BROKEN_JSON = path.join(FIXTURE_DIR, 'malformed-broken-syntax.json')
const FIXTURE_INVALID_STRUCT_JSON = path.join(FIXTURE_DIR, 'structurally-invalid.json')
const FIXTURE_VALID_V2_JSON = path.join(FIXTURE_DIR, 'valid-v2-for-quota.json')

// chrome.storage.local 匯入相關 key（對齊 TagStorageAdapter.STORAGE_KEYS / uc04 慣例）
const STORAGE_KEY_TAGS = 'tags'
const STORAGE_KEY_CATEGORIES = 'tag_categories'

// 配額閘門檻：TagStorageAdapter MAX_STORAGE_SIZE=5MB，BLOCK 門檻 0.95。
// 覆寫 getBytesInUse 回傳此值（96% 用量）以命中 blocked 分支。
const MAX_STORAGE_SIZE = 5242880
const QUOTA_BLOCKED_BYTES = Math.ceil(MAX_STORAGE_SIZE * 0.96)

// 場景 B「不崩潰」降級觀察窗：在此時間窗內持續確認 storage 維持 0 本書。
// 大於 DOM 解析 + flow 寫入的合理時間，使「錯誤資料若會被寫入」能被觀察到。
const DEGRADE_OBSERVE_WINDOW = 6000
const DEGRADE_POLL_INTERVAL = 500

// 場景 C/D-G 錯誤訊息顯示等待上限
const ERROR_DISPLAY_TIMEOUT = DEFAULT_NAV_TIMEOUT

describe('UC-07 錯誤處理 E2E (W4-001.3)', () => {
  // ========== G1：場景 B — Readmoo DOM 結構變更優雅降級 ==========

  describe('G1 場景 B：DOM 結構變更優雅降級 (use-cases.md 場景 B)', () => {
    const setup = new ExtensionTestSetup()
    let setupError = null
    const pageErrors = []

    /**
     * 為 page 設定 request interception，將「mutated」fixture 服務於 readmoo.com。
     *
     * 與 extraction-flow.setupReadmooInterception 同模式，但讀本檔專屬 mutated
     * fixture（既有 helper 硬編碼正常 fixture，不可改）。fixture 的 v2 命名使
     * adapter 所有 selector 失效，提取結果應為 0 本書。
     *
     * @param {import('puppeteer').Page} page - Puppeteer Page 實例
     * @returns {Promise<void>}
     */
    async function setupMutatedInterception (page) {
      const mutatedHtml = fs.readFileSync(FIXTURE_MUTATED_HTML, 'utf8')
      await page.setRequestInterception(true)
      page.on('request', req => {
        const url = req.url()
        if (url.startsWith(FIXTURE_URL)) {
          req.respond({
            status: 200,
            contentType: 'text/html; charset=utf-8',
            body: mutatedHtml
          })
        } else if (url.startsWith('https://readmoo.com') || url.startsWith('http://readmoo.com')) {
          req.respond({
            status: 200,
            contentType: 'text/html',
            body: '<!DOCTYPE html><html><body></body></html>'
          })
        } else {
          req.continue()
        }
      })
    }

    /**
     * 透過 SW 對 fixture tab 直送 START_EXTRACTION（與 extraction-flow.triggerExtraction
     * 同機制），回傳 content script 的即時回應（flow 啟動結果）。
     *
     * 不在此等待書數達標（場景 B 期望 0 本，無達標可言）；實際降級觀察由 caller
     * 的 bounded poll 完成。
     *
     * @returns {Promise<Object>} content script START_EXTRACTION 回應
     */
    async function triggerExtractionRaw () {
      const worker = await getServiceWorker(setup.browser)
      return worker.evaluate(async () => {
        const tabs = await chrome.tabs.query({})
        const target = tabs.find(t => t.url && t.url.includes('readmoo.com/library'))
        if (!target) {
          return { success: false, error: 'fixture tab 不存在' }
        }
        try {
          const resp = await chrome.tabs.sendMessage(target.id, { type: 'START_EXTRACTION' })
          return resp || { success: false, error: '提取無回應' }
        } catch (error) {
          return { success: false, error: error.message }
        }
      })
    }

    /**
     * 在觀察窗內持續確認 storage 書數維持 0（不被寫入錯誤資料）。
     *
     * 回傳觀察窗內讀到的最大書數；> 0 表示降級失敗（提取把錯誤資料寫進 storage）。
     *
     * @returns {Promise<number>} 觀察窗內 storage 書數最大值
     */
    async function observeStorageStaysEmpty () {
      const deadline = Date.now() + DEGRADE_OBSERVE_WINDOW
      let maxCount = 0
      while (Date.now() < deadline) {
        const books = await readBooksFromStorage(setup.browser)
        if (books.length > maxCount) {
          maxCount = books.length
        }
        await new Promise(resolve => setTimeout(resolve, DEGRADE_POLL_INTERVAL))
      }
      return maxCount
    }

    /**
     * SW 對 fixture tab 送 PING 確認 content script 仍存活（不崩潰）。
     *
     * @returns {Promise<boolean>} content script 是否回應 success
     */
    async function isContentScriptAlive () {
      const worker = await getServiceWorker(setup.browser)
      return worker.evaluate(async () => {
        const tabs = await chrome.tabs.query({})
        const target = tabs.find(t => t.url && t.url.includes('readmoo.com/library'))
        if (!target) return false
        try {
          const resp = await chrome.tabs.sendMessage(target.id, { type: 'PING' })
          return !!(resp && resp.success)
        } catch {
          return false
        }
      })
    }

    let startResponse = null
    let maxStorageCount = -1
    let contentScriptAlive = false

    beforeAll(async () => {
      try {
        await setup.setup()
        await clearBooksStorage(setup.browser)

        // 收集 fixture page 端 JS runtime error（pageerror）——DOM 解析失敗不應使頁面崩潰
        setup.page.on('pageerror', error => {
          pageErrors.push(error.message)
        })

        // 服務 mutated fixture + 導航 + 等待 content script 注入就緒
        await setupMutatedInterception(setup.page)
        await setup.page.goto(FIXTURE_URL, {
          waitUntil: 'domcontentloaded',
          timeout: DEFAULT_NAV_TIMEOUT
        })
        await waitForContentScriptReady(setup)

        // 觸發提取（即時回應），再以觀察窗確認 storage 維持空 + content script 存活
        startResponse = await triggerExtractionRaw()
        maxStorageCount = await observeStorageStaysEmpty()
        contentScriptAlive = await isContentScriptAlive()
      } catch (error) {
        setupError = error
      }
    }, JEST_TEST_TIMEOUT)

    afterAll(async () => {
      const CLEANUP_TIMEOUT = 15000
      await Promise.race([
        setup.cleanup(),
        new Promise(resolve => setTimeout(resolve, CLEANUP_TIMEOUT))
      ])
    }, JEST_TEST_TIMEOUT)

    function assertSetupSucceeded () {
      if (setupError) {
        throw new Error(`[SETUP] G1 beforeAll 前置失敗，無法執行斷言: ${setupError.message}`)
      }
    }

    test('[SETUP] G1-1 mutated fixture 導航成功且既有 selector 不命中（0 個 .library-item）', async () => {
      assertSetupSucceeded()
      // mutated fixture 視覺上有 5 個書卡（.shelf-card-v2），但 adapter 用的 .library-item 0 個
      const libraryItemCount = await setup.page.$$eval('.library-item', els => els.length).catch(() => 0)
      const mutatedCardCount = await setup.page.$$eval('.shelf-card-v2', els => els.length)
      expect(libraryItemCount).toBe(0)
      expect(mutatedCardCount).toBe(5)
    })

    test('[DEGRADE] G1-2 START_EXTRACTION 即時回應不拋例外（flow 啟動成功）', () => {
      assertSetupSucceeded()
      // content-modular.js handleBackgroundMessage：提取器存在時即時回 success+flowId。
      // DOM 解析失敗發生在 flow 內，不應使 START_EXTRACTION 訊息處理本身拋錯/無回應。
      expect(startResponse).not.toBeNull()
      expect(typeof startResponse).toBe('object')
      expect(startResponse.success).toBe(true)
    })

    test('[DEGRADE] G1-3 提取 0 本書且 storage 不被寫入錯誤資料（優雅降級核心）', () => {
      assertSetupSucceeded()
      // 觀察窗內 storage 書數最大值應為 0：selector 全失效 → 無書可提取，
      // 且不得把空/錯誤資料寫進 readmoo_books。> 0 表示降級失敗（寫了垃圾資料）。
      expect(maxStorageCount).toBe(0)
    })

    test('[DEGRADE] G1-4 content script 與頁面不崩潰（無 pageerror + PING 存活）', () => {
      assertSetupSucceeded()
      // DOM 解析失敗應優雅降級，不得導致 page JS 崩潰或 content script 死亡。
      expect(pageErrors).toEqual([])
      expect(contentScriptAlive).toBe(true)
    })
  })

  // ========== G2 + G3：場景 C / D-G — 共用 overview page 前置 ==========

  describe('UC-07 匯入錯誤與配額（共用 overview）', () => {
    const setup = new ExtensionTestSetup()
    let overviewPage = null
    let setupError = null

    /**
     * 讀取 storage 書籍陣列（雙形態容錯：物件含 .books / 直接陣列）。
     *
     * 錯誤場景只需驗證 books 是否被污染（維持 0 本），故重用 storage-reader 的
     * readBooksFromStorage（僅讀 readmoo_books），不需 uc04 的多 key 讀取 helper。
     *
     * @returns {Promise<Array>} 書籍物件陣列；無資料時回傳空陣列
     */
    async function readBooks () {
      return readBooksFromStorage(setup.browser)
    }

    /**
     * 清空 chrome.storage.local 三個匯入相關 key（books / tags / tag_categories）。
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
     * 注入 fixture 至 #jsonFileInput 並 click #loadFileBtn 觸發匯入；若 modal 出現
     * 則 click 對應模式按鈕。錯誤路徑（場景 C）通常在 read/parse 階段拋錯，故 modal
     * 步驟以「存在才點」容錯（驗證在 modal 之後失敗）。
     *
     * 與 uc04-import.importFixture 同鏈路，差異：
     * - 不強制等待持久化完成（錯誤路徑不會持久化）。
     * - modal 等待採可選（有些錯誤路徑在 validate 階段即拋，不到 modal；本檔場景 C
     *   兩 fixture 皆 .json 通過 validate、會到 modal，但仍保留容錯）。
     *
     * @param {import('puppeteer').Page} page - overview page
     * @param {string} fixturePath - fixture 檔案絕對路徑
     * @param {'overwrite'|'merge'} mode - 匯入模式（modal 出現時點選）
     * @returns {Promise<void>}
     */
    async function injectImport (page, fixturePath, mode) {
      await page.waitForSelector('#fileUploader', { timeout: DEFAULT_NAV_TIMEOUT })
      await page.evaluate(() => {
        const uploader = document.getElementById('fileUploader')
        if (uploader) uploader.style.display = 'block'
      })
      await page.waitForSelector('#jsonFileInput', { timeout: DEFAULT_NAV_TIMEOUT })

      const fileInput = await page.$('#jsonFileInput')
      if (!fileInput) {
        throw new Error('[SETUP] 找不到 #jsonFileInput，無法注入 fixture 檔案')
      }
      await fileInput.uploadFile(fixturePath)
      await page.click('#loadFileBtn')

      // modal 出現才點選模式（容錯：validate 階段就拋錯的路徑不會出 modal）
      const modeBtnId = mode === 'overwrite' ? 'importModeOverwriteBtn' : 'importModeMergeBtn'
      try {
        await page.waitForSelector('#importModeOverlay', { visible: true, timeout: 5000 })
        await page.click(`#${modeBtnId}`)
      } catch (_) {
        // modal 未出現（validate 階段拋錯）：場景 C 兩 fixture 皆 .json 應會出 modal，
        // 但保留容錯以免錯誤路徑變動造成假失敗。
      }
    }

    /**
     * polling 等待 #errorContainer 顯示且 #errorMessage 有文字。
     *
     * showError 將 errorContainer display 設為 block 並寫入 errorMessage textContent。
     * 用 polling 取代固定 sleep（test-assertion-design-rules）。
     *
     * @param {import('puppeteer').Page} page - overview page
     * @param {number} [timeout=ERROR_DISPLAY_TIMEOUT] - 逾時毫秒數
     * @returns {Promise<string>} 顯示的錯誤訊息文字
     * @throws {Error} 逾時未顯示錯誤訊息時拋錯（[SETUP] 前綴）
     */
    async function waitForErrorDisplayed (page, timeout = ERROR_DISPLAY_TIMEOUT) {
      const deadline = Date.now() + timeout
      let lastState = null
      while (Date.now() < deadline) {
        const state = await page.evaluate(() => {
          const container = document.getElementById('errorContainer')
          const message = document.getElementById('errorMessage')
          const visible = !!(container && container.style.display !== 'none')
          const text = message ? (message.textContent || '') : ''
          return { visible, text }
        })
        lastState = state
        if (state.visible && state.text.trim().length > 0) {
          return state.text
        }
        await new Promise(resolve => setTimeout(resolve, 250))
      }
      throw new Error(
        `[SETUP] 未在 ${timeout}ms 內顯示錯誤訊息（最後狀態: ${JSON.stringify(lastState)}）`
      )
    }

    /**
     * 重置 overview 錯誤狀態（hideError + 清空 errorMessage），避免前一案例殘留
     * 訊息干擾下一案例的斷言。直接操作 DOM（還原顯示狀態），不繞過業務邏輯。
     *
     * @param {import('puppeteer').Page} page - overview page
     * @returns {Promise<void>}
     */
    async function resetErrorState (page) {
      await page.evaluate(() => {
        const container = document.getElementById('errorContainer')
        const message = document.getElementById('errorMessage')
        if (container) container.style.display = 'none'
        if (message) message.textContent = ''
      })
    }

    beforeAll(async () => {
      try {
        await setup.setup()
        await clearAllImportStorage()

        overviewPage = await setup.browser.newPage()
        // 安全網：自動關閉任何 dialog，避免錯誤路徑的 alert 阻塞 Puppeteer 而 hang
        overviewPage.on('dialog', async dialog => {
          try { await dialog.dismiss() } catch (_) { /* dialog 已關閉 */ }
        })

        const overviewUrl = `chrome-extension://${setup.extensionId}/src/overview/overview.html`
        await overviewPage.goto(overviewUrl, {
          waitUntil: 'domcontentloaded',
          timeout: DEFAULT_NAV_TIMEOUT
        })

        // 等待 OverviewPageController 初始化完成（匯入入口承載者）
        await overviewPage.waitForFunction(
          () => typeof window.overviewPage === 'object' &&
                typeof window.overviewPage.controller === 'function' &&
                window.overviewPage.controller() !== null,
          { timeout: DEFAULT_NAV_TIMEOUT }
        )
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
      const CLEANUP_TIMEOUT = 15000
      await Promise.race([
        setup.cleanup(),
        new Promise(resolve => setTimeout(resolve, CLEANUP_TIMEOUT))
      ])
    }, JEST_TEST_TIMEOUT)

    function assertSetupSucceeded () {
      if (setupError) {
        throw new Error(`[SETUP] G2/G3 beforeAll 前置失敗，無法執行斷言: ${setupError.message}`)
      }
    }

    // ========== G2：場景 C — 檔案匯入格式錯誤（acceptance #2）==========

    describe('G2 場景 C：檔案匯入格式錯誤 (use-cases.md 場景 C)', () => {
      let brokenSyntaxError = null
      let invalidStructError = null
      let booksAfterBroken = []
      let booksAfterInvalid = []
      let caseError = null

      beforeAll(async () => {
        if (setupError) return
        try {
          await clearAllImportStorage()

          // 案例 C-1：JSON 語法損壞 → PARSE_ERROR（覆蓋模式進入 modal 後 read/parse 拋錯）
          await resetErrorState(overviewPage)
          await injectImport(overviewPage, FIXTURE_BROKEN_JSON, 'overwrite')
          brokenSyntaxError = await waitForErrorDisplayed(overviewPage)
          booksAfterBroken = await readBooks()

          // 案例 C-2：JSON 合法但結構不符 → VALIDATION_ERROR
          await resetErrorState(overviewPage)
          await injectImport(overviewPage, FIXTURE_INVALID_STRUCT_JSON, 'overwrite')
          invalidStructError = await waitForErrorDisplayed(overviewPage)
          booksAfterInvalid = await readBooks()
        } catch (error) {
          caseError = error
        }
      }, JEST_TEST_TIMEOUT)

      test('[SETUP] G2-1 兩個錯誤匯入案例前置完成（皆顯示錯誤訊息）', () => {
        assertSetupSucceeded()
        if (caseError) throw new Error(`[SETUP] 場景 C 匯入前置失敗: ${caseError.message}`)
        expect(typeof brokenSyntaxError).toBe('string')
        expect(typeof invalidStructError).toBe('string')
      })

      test('[IMPORT] G2-2 語法損壞 JSON 匯入顯示格式錯誤訊息（不崩潰）', () => {
        assertSetupSucceeded()
        if (caseError) throw new Error(`[SETUP] 場景 C 匯入前置失敗: ${caseError.message}`)
        // FileContentReader._handleSuccess 對 parse 拋錯前綴 '載入檔案失敗：'，
        // ContentParser._parseJSONContent SyntaxError → message 'JSON 檔案格式不正確'。
        // 斷言錯誤訊息明確提及「格式」，使用者可理解錯誤原因（規格成功標準：訊息清楚）。
        expect(brokenSyntaxError.length).toBeGreaterThan(0)
        expect(brokenSyntaxError).toContain('格式')
      })

      test('[IMPORT] G2-3 結構不符 JSON 匯入顯示驗證錯誤訊息（不崩潰）', () => {
        assertSetupSucceeded()
        if (caseError) throw new Error(`[SETUP] 場景 C 匯入前置失敗: ${caseError.message}`)
        // ContentParser._extractBooksFromData path E：非陣列且無 books 屬性 →
        // VALIDATION_ERROR message 含「books」。錯誤訊息應指向結構不符。
        expect(invalidStructError.length).toBeGreaterThan(0)
        expect(invalidStructError).toContain('books')
      })

      test('[IMPORT] G2-4 錯誤匯入不污染 storage（books 維持 0 本）', () => {
        assertSetupSucceeded()
        if (caseError) throw new Error(`[SETUP] 場景 C 匯入前置失敗: ${caseError.message}`)
        // 解析失敗在持久化前中止，storage 不應被寫入任何書（規格：無資料遺失/損壞）。
        expect(booksAfterBroken.length).toBe(0)
        expect(booksAfterInvalid.length).toBe(0)
      })
    })

    // ========== G3：場景 D/G — 儲存配額不足（acceptance #3）==========

    describe('G3 場景 D/G：儲存配額不足攔截 (use-cases.md 場景 D/G)', () => {
      let quotaError = null
      let booksAfterQuota = []
      let caseError = null

      beforeAll(async () => {
        if (setupError) return
        try {
          await clearAllImportStorage()
          await resetErrorState(overviewPage)

          // 在 overview page context 覆寫 getBytesInUse 回傳 96% 用量，命中真實配額閘
          // blocked 分支（>=95%）。覆寫僅替換用量量測來源，不繞過配額決策邏輯。
          await overviewPage.evaluate((blockedBytes) => {
            const original = chrome.storage.local.getBytesInUse.bind(chrome.storage.local)
            // 保存原始函式以便測試後還原
            window.__originalGetBytesInUse = original
            chrome.storage.local.getBytesInUse = function (keys, callback) {
              // 對齊 TagStorageAdapter.getBytesInUse 的 (null, cb) 呼叫形式
              if (typeof keys === 'function') {
                keys(blockedBytes)
                return
              }
              if (typeof callback === 'function') {
                callback(blockedBytes)
              }
            }
          }, QUOTA_BLOCKED_BYTES)

          // 匯入合法 v2 檔案——配額閘應在持久化前攔截
          await injectImport(overviewPage, FIXTURE_VALID_V2_JSON, 'overwrite')
          quotaError = await waitForErrorDisplayed(overviewPage)
          booksAfterQuota = await readBooks()

          // 還原 getBytesInUse（避免污染後續測試）
          await overviewPage.evaluate(() => {
            if (typeof window.__originalGetBytesInUse === 'function') {
              chrome.storage.local.getBytesInUse = window.__originalGetBytesInUse
              delete window.__originalGetBytesInUse
            }
          })
        } catch (error) {
          caseError = error
          // 確保即使失敗也嘗試還原（best-effort）
          try {
            await overviewPage.evaluate(() => {
              if (typeof window.__originalGetBytesInUse === 'function') {
                chrome.storage.local.getBytesInUse = window.__originalGetBytesInUse
                delete window.__originalGetBytesInUse
              }
            })
          } catch (_) { /* page 已關閉 */ }
        }
      }, JEST_TEST_TIMEOUT)

      test('[SETUP] G3-1 配額攔截案例前置完成（顯示錯誤訊息）', () => {
        assertSetupSucceeded()
        if (caseError) throw new Error(`[SETUP] 場景 D/G 配額前置失敗: ${caseError.message}`)
        expect(typeof quotaError).toBe('string')
      })

      test('[QUOTA] G3-2 配額不足時顯示空間不足警告訊息', () => {
        assertSetupSucceeded()
        if (caseError) throw new Error(`[SETUP] 場景 D/G 配額前置失敗: ${caseError.message}`)
        // ImportFlowController.execute：writeResult.error === 'quota_exceeded' →
        // showError('儲存空間不足，匯入未完成')。斷言訊息明確提及空間不足。
        expect(quotaError.length).toBeGreaterThan(0)
        expect(quotaError).toContain('空間不足')
      })

      test('[QUOTA] G3-3 配額攔截在持久化前發生，storage 未被寫入（books 維持 0 本）', () => {
        assertSetupSucceeded()
        if (caseError) throw new Error(`[SETUP] 場景 D/G 配額前置失敗: ${caseError.message}`)
        // checkQuotaLevel 在 replaceAllData 寫入前攔截，回 quota_exceeded → 不寫 storage。
        expect(booksAfterQuota.length).toBe(0)
      })
    })
  })
})
