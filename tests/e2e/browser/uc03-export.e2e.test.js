/**
 * uc03-export.e2e.test.js — UC-03 資料匯出真實瀏覽器 E2E regression 測試（W4-001.1）
 *
 * 負責功能：
 * - 在真實 Chrome + 已載入 Extension 環境下，驗證 UC-03 匯出鏈完整路徑：
 *   提取 fixture 5 本書 -> 開啟 overview -> 真實 click #exportJSONBtn / #exportCSVBtn
 *   -> overview-page-controller handleExportJSONv2 / handleExportCSVv2
 *   -> BookDataExporter v2 -> blob 下載
 * - 攔截下載 blob 內容並斷言匯出格式合規（Interchange Format v2 / CSV tag 欄 + 閱讀狀態欄）
 * - 補 W1-001.2 手動驗證後缺少的自動化 regression 防護（quality-baseline 規則 5）
 *
 * 測試定位（§3.5 B1）：
 * - regression 鎖定型 E2E。常態 GREEN，鎖定匯出格式不因後續重構而回歸。
 * - 與 extraction-pipeline.e2e.test.js / popup-extraction-click.e2e.test.js 互補：
 *   前兩者覆蓋提取-儲存-顯示與 popup click 觸發，本檔覆蓋 overview 匯出下游。
 *
 * 測試結構分層（前綴揭露失敗性質）：
 * - [SETUP]  前綴：環境 / 提取 / overview 載入前置失敗
 * - [JSON]   前綴：JSON 匯出格式 regression（Interchange Format v2 結構）
 * - [CSV]    前綴：CSV 匯出格式 regression（tag 欄 + readingStatus 欄）
 *
 * blob 攔截設計考量：
 * - W1-001.2 曾遇 isolated profile 下載檔案落地定位困難。改採 page context 內
 *   override URL.createObjectURL 攔截 blob，於 click 觸發下載前安裝攔截器，
 *   click 後在 page context 用 FileReader 讀回 blob 文字。
 * - 此做法完整經過真實按鈕 click -> 事件處理器 -> BookDataExporter -> Blob 鏈路，
 *   僅替換「blob -> object URL」這一步以取得內容，不繞過任何匯出業務邏輯。
 * - _triggerExportDownload 內呼叫 URL.revokeObjectURL，故攔截器在 createObjectURL
 *   當下即同步啟動讀取（FileReader.readAsText），避免 revoke 後 blob 失效。
 * - 攔截結果以「已解析字串」直接 push 至 window.__capturedExports，測試端只 poll
 *   純資料陣列，不跨 Puppeteer bridge await page 內 Promise（避免 FileReader 永不
 *   resolve 時 evaluate 無 timeout hang，W4-001.1 spike 實證）。
 *
 * 規格依據：
 * - JSON：docs/spec/export-interchange-format-v2.md §3（root 含 metadata / tagCategories /
 *   tags / books 四區段，metadata.formatVersion='2.0.0'，書 tagIds 為陣列）
 * - CSV：docs/spec/export-interchange-format-v2.md §5（COMPLETE_V2 preset header
 *   含 readingStatus / tagIds / tagNames / tagCategories，陣列以 '; ' 分隔）
 * - overview 匯出採 COMPLETE_V2 preset（overview-page-controller CONSTANTS.EXPORT_V2.FIELD_PRESET）
 *
 * 執行方式：npm run test:e2e:browser（注意：npm run test:e2e 以 testPathIgnorePatterns
 *   排除 browser/，本檔須用 test:e2e:browser）
 * 前置：須先 npm run build:dev 產出 build/development（Extension 載入路徑）
 */

const ExtensionTestSetup = require('../setup/extension-setup')
const { clearBooksStorage } = require('./helpers/storage-reader')
const {
  FIXTURE_BOOK_COUNT,
  runExtraction
} = require('./helpers/extraction-flow')
const {
  DEFAULT_NAV_TIMEOUT,
  JEST_TEST_TIMEOUT
} = require('./helpers/timeouts')

// v1.1 model readingStatus 6 狀態 enum（與 export-interchange-format-v2.md §3.6 一致）
const READING_STATUS_ENUM = ['unread', 'reading', 'finished', 'queued', 'abandoned', 'reference']

// Interchange Format v2 root 必含的四個頂層區段（spec §3.1）
const V2_ROOT_SECTIONS = ['metadata', 'tagCategories', 'tags', 'books']

// COMPLETE_V2 CSV header 必含的 tag 與閱讀狀態相關欄位（spec §5.1）
// readingStatus 為承載 6 狀態 model 的欄位；tagIds/tagNames/tagCategories 為 tag 欄位
const CSV_REQUIRED_TAG_STATUS_COLUMNS = ['readingStatus', 'tagIds', 'tagNames', 'tagCategories']

describe('UC-03 資料匯出 E2E (W4-001.1)', () => {
  const setup = new ExtensionTestSetup()
  let overviewPage = null
  let extractedBooks = []
  let setupError = null
  const dialogMessages = []

  /**
   * 在 overview page context 安裝 blob 攔截器
   *
   * override URL.createObjectURL：每次被呼叫時同步以 FileReader 讀取 blob 文字，
   * 於 onload callback 將已解析字串 push 至 window.__capturedExports（讀取錯誤 push
   * 至 window.__captureErrors）。原始 createObjectURL 仍被呼叫以回傳合法 object URL
   * （讓 _triggerExportDownload 的 anchor.click 流程正常進行）。
   *
   * 設計考量：
   * - 在 click 前安裝，確保攔截器先於下載觸發就位。
   * - createObjectURL 當下即啟動讀取（非延遲到 click 後），避免 revokeObjectURL
   *   先於讀取執行導致 blob 失效。
   *
   * @param {import('puppeteer').Page} page - overview page
   * @returns {Promise<void>}
   */
  async function installBlobInterceptor (page) {
    await page.evaluate(() => {
      // 暫存「已解析」的匯出內容（非 Promise）。設計考量：
      // 不跨 Puppeteer bridge await page 內 Promise——若 FileReader 永不 resolve，
      // 跨 bridge 的 evaluate 會無限 hang 且無 timeout。改為在 FileReader.onload
      // callback 內直接 push 解析後的字串，測試端只 poll 純資料陣列。
      window.__capturedExports = []
      window.__captureErrors = []
      const originalCreateObjectURL = URL.createObjectURL.bind(URL)
      URL.createObjectURL = function (blob) {
        try {
          const reader = new FileReader()
          const mime = blob.type
          reader.onload = () => {
            window.__capturedExports.push({ type: mime, text: String(reader.result) })
          }
          reader.onerror = () => {
            window.__captureErrors.push(
              (reader.error && reader.error.message) || 'FileReader 讀取失敗'
            )
          }
          reader.readAsText(blob)
        } catch (error) {
          window.__captureErrors.push(error && error.message ? error.message : String(error))
        }
        // 仍回傳合法 object URL，使 _triggerExportDownload 的 anchor.click 正常進行
        return originalCreateObjectURL(blob)
      }
    })
  }

  /**
   * 真實 click 指定匯出按鈕並取回攔截的 blob 文字內容
   *
   * 採「click 後 polling 純資料陣列」模式，每次 poll 只讀取 window.__capturedExports
   * 的最後一筆已解析結果，避免跨 bridge await page 內 Promise 造成無 timeout hang。
   *
   * @param {import('puppeteer').Page} page - overview page
   * @param {string} buttonId - 匯出按鈕 id（exportJSONBtn / exportCSVBtn）
   * @returns {Promise<{type: string, text: string}>} 攔截的 blob MIME 與文字
   * @throws {Error} 逾時未攔截到 blob 時拋錯（[SETUP] 前綴）
   */
  async function clickExportAndCaptureBlob (page, buttonId) {
    // 記錄本次 click 前已攔截筆數，確保取到的是本次 click 對應的下載
    const baseline = await page.evaluate(() => window.__capturedExports.length)

    // 真實 click 按鈕（觸發 addEventListener('click') -> handleExport*v2 -> blob）
    await page.click(`#${buttonId}`)

    // 匯出處理器為 async（讀 storage tag 資料），polling 等待 blob 被攔截並讀取完成
    const deadline = Date.now() + DEFAULT_NAV_TIMEOUT
    while (Date.now() < deadline) {
      const state = await page.evaluate((base) => ({
        captured: window.__capturedExports.slice(base),
        errors: window.__captureErrors.slice()
      }), baseline)

      if (state.errors.length > 0) {
        throw new Error(`[SETUP] blob 讀取失敗: ${state.errors.join('; ')}`)
      }
      const latest = state.captured[state.captured.length - 1]
      if (latest && typeof latest.text === 'string' && latest.text.length > 0) {
        return latest
      }
      await new Promise(resolve => setTimeout(resolve, 200))
    }

    throw new Error(`[SETUP] click #${buttonId} 後未在 ${DEFAULT_NAV_TIMEOUT}ms 內攔截到匯出 blob`)
  }

  beforeAll(async () => {
    try {
      await setup.setup()
      await clearBooksStorage(setup.browser)

      // 步驟 1：提取 fixture 5 本書（SW 直送 START_EXTRACTION，完整 content pipeline）
      const result = await runExtraction(setup)
      extractedBooks = result.books

      // 步驟 2：開啟 overview 頁（event-driven 自動讀 storage 渲染清單）
      overviewPage = await setup.browser.newPage()

      // 安全網：自動關閉任何 dialog（alert/confirm）。匯出 handler 在無資料時會
      // alert(NO_DATA_EXPORT)，Puppeteer 預設會被 dialog 阻塞而 hang。本測試預期
      // 有資料故不應觸發 dialog，但保留 handler 防止任一 dialog 卡死整個測試流程；
      // 觸發的 dialog 文字記錄於 dialogMessages 供斷言/除錯。
      overviewPage.on('dialog', async dialog => {
        dialogMessages.push(dialog.message())
        try { await dialog.dismiss() } catch (_) { /* dialog 已關閉 */ }
      })

      const overviewUrl = `chrome-extension://${setup.extensionId}/src/overview/overview.html`
      await overviewPage.goto(overviewUrl, {
        waitUntil: 'domcontentloaded',
        timeout: DEFAULT_NAV_TIMEOUT
      })

      // 步驟 3：等待書籍清單渲染完成（確認 overview 已載入 storage 資料）
      await overviewPage.waitForSelector('#tableBody tr', { timeout: DEFAULT_NAV_TIMEOUT })

      // 步驟 4：安裝 blob 攔截器（下載觸發前就位）
      await installBlobInterceptor(overviewPage)
    } catch (error) {
      setupError = error
    }
  }, JEST_TEST_TIMEOUT)

  afterAll(async () => {
    if (overviewPage) {
      try { await overviewPage.close() } catch (_) { /* overview 已關閉 */ }
    }
    // cleanup 以 timeout race 包裹：browser.close() 在多 Chrome instance 連續啟動的
    // 全套件情境下偶爾 hang（headed Chrome 資源競爭，全套件實測 afterAll 超過 90s），
    // 但程序退出時 Chrome 仍會被回收。bounded cleanup 確保 hook 不被 browser.close
    // 無限阻塞——優先嘗試 graceful close，逾 CLEANUP_TIMEOUT 則放手由程序退出回收。
    const CLEANUP_TIMEOUT = 15000
    await Promise.race([
      setup.cleanup(),
      new Promise(resolve => setTimeout(resolve, CLEANUP_TIMEOUT))
    ])
  }, JEST_TEST_TIMEOUT)

  /**
   * 確保 beforeAll setup 未失敗；失敗以 [SETUP] 前綴拋出，
   * 使 RED 驗證能區分環境故障與匯出格式 regression。
   */
  function assertSetupSucceeded () {
    if (setupError) {
      throw new Error(`[SETUP] beforeAll 前置失敗，無法執行斷言: ${setupError.message}`)
    }
  }

  // ========== G1：環境與提取前置（setup 驗證）==========

  describe('G1 環境就緒與提取前置', () => {
    test('[SETUP] G1-1 提取後 storage 寫入 5 本書且 overview 渲染清單', async () => {
      assertSetupSucceeded()
      expect(extractedBooks.length).toBe(FIXTURE_BOOK_COUNT)
      // overview 表格列數應對應提取書數（確認 overview 確實載入 storage 資料）
      const rowCount = await overviewPage.$$eval('#tableBody tr', rows => rows.length)
      expect(rowCount).toBe(FIXTURE_BOOK_COUNT)
    })
  })

  // ========== G2：UC-03 JSON 匯出（acceptance #1，Interchange Format v2）==========

  describe('G2 UC-03 JSON 匯出 (Interchange Format v2)', () => {
    let jsonExport = null

    beforeAll(async () => {
      if (setupError) return
      // 1.0.0-W4-001：主「匯出 JSON」鈕（exportJSONBtn）改走 v3 canonical；
      // v2 相容路徑移至 exportJSONv2Btn，故本 v2 契約測試改點 v2 相容鈕。
      const captured = await clickExportAndCaptureBlob(overviewPage, 'exportJSONv2Btn')
      jsonExport = { mime: captured.type, parsed: JSON.parse(captured.text) }
    }, JEST_TEST_TIMEOUT)

    test('[SETUP] G2-1 click #exportJSONv2Btn 攔截到 JSON blob 且可解析', () => {
      assertSetupSucceeded()
      // 匯出按鈕點到時 overview 須有資料；NO_DATA_EXPORT dialog 觸發代表無資料，
      // 後續格式斷言失去意義
      const noDataDialogs = dialogMessages.filter(msg => msg && msg.includes('沒有資料'))
      expect(noDataDialogs).toEqual([])
      expect(jsonExport).not.toBeNull()
      expect(jsonExport.mime).toContain('application/json')
      expect(jsonExport.parsed).toBeInstanceOf(Object)
    })

    test('[JSON] G2-2 root 含 Interchange Format v2 四個頂層區段', () => {
      assertSetupSucceeded()
      V2_ROOT_SECTIONS.forEach(section => {
        expect(Object.prototype.hasOwnProperty.call(jsonExport.parsed, section)).toBe(true)
      })
      expect(Array.isArray(jsonExport.parsed.tagCategories)).toBe(true)
      expect(Array.isArray(jsonExport.parsed.tags)).toBe(true)
      expect(Array.isArray(jsonExport.parsed.books)).toBe(true)
    })

    test('[JSON] G2-3 metadata.formatVersion 為 2.0.0 且 totalBooks 一致', () => {
      assertSetupSucceeded()
      const metadata = jsonExport.parsed.metadata
      expect(metadata).toBeInstanceOf(Object)
      expect(metadata.formatVersion).toBe('2.0.0')
      expect(metadata.source).toBe('readmoo-book-extractor')
      // totalBooks 與 books 陣列長度交叉驗證（spec §3.2）
      expect(metadata.totalBooks).toBe(jsonExport.parsed.books.length)
      expect(jsonExport.parsed.books.length).toBe(FIXTURE_BOOK_COUNT)
    })

    test('[JSON] G2-4 每本書 readingStatus 為 6 狀態合法值且 tagIds 為陣列', () => {
      assertSetupSucceeded()
      const books = jsonExport.parsed.books
      expect(books.length).toBe(FIXTURE_BOOK_COUNT)
      books.forEach(book => {
        expect(typeof book.id).toBe('string')
        expect(book.id.length).toBeGreaterThan(0)
        expect(typeof book.title).toBe('string')
        expect(book.title.length).toBeGreaterThan(0)
        // readingStatus 為 6 狀態 enum 合法成員（spec §3.6）
        expect(READING_STATUS_ENUM).toContain(book.readingStatus)
        // 強制規範（spec §3.5）：書無 tag 時 tagIds 為空陣列，不可省略欄位
        expect(Object.prototype.hasOwnProperty.call(book, 'tagIds')).toBe(true)
        expect(Array.isArray(book.tagIds)).toBe(true)
      })
    })
  })

  // ========== G3：UC-03 CSV 匯出（acceptance #2，tag 欄 + 閱讀狀態欄）==========

  describe('G3 UC-03 CSV 匯出 (tag 欄 + readingStatus)', () => {
    let csvExport = null
    let headerColumns = []

    beforeAll(async () => {
      if (setupError) return
      const captured = await clickExportAndCaptureBlob(overviewPage, 'exportCSVBtn')
      csvExport = { mime: captured.type, text: captured.text }
      // 取得 header 行：跳過 # 起始的 source limitation 註解列（spec §5 / W1-061.2）
      const lines = captured.text.split('\n').filter(line => line.length > 0)
      const headerLine = lines.find(line => !line.startsWith('#'))
      headerColumns = headerLine ? headerLine.split(',').map(c => c.trim()) : []
    }, JEST_TEST_TIMEOUT)

    test('[SETUP] G3-1 click #exportCSVBtn 攔截到 CSV blob 且非空', () => {
      assertSetupSucceeded()
      expect(csvExport).not.toBeNull()
      expect(csvExport.mime).toContain('text/csv')
      expect(csvExport.text.length).toBeGreaterThan(0)
      expect(headerColumns.length).toBeGreaterThan(0)
    })

    test('[CSV] G3-2 header 含 tag 欄位與 readingStatus 閱讀狀態欄', () => {
      assertSetupSucceeded()
      CSV_REQUIRED_TAG_STATUS_COLUMNS.forEach(column => {
        expect(headerColumns).toContain(column)
      })
    })

    test('[CSV] G3-3 資料列數對應提取書數且 readingStatus 值為 6 狀態合法值', () => {
      assertSetupSucceeded()
      const lines = csvExport.text.split('\n').filter(line => line.length > 0)
      // 資料列 = 總非空行 - 註解列(#) - header 列
      const commentLineCount = lines.filter(line => line.startsWith('#')).length
      const dataLines = lines.slice(commentLineCount + 1)
      expect(dataLines.length).toBe(FIXTURE_BOOK_COUNT)

      // 解析每列 readingStatus 欄並驗證為合法 6 狀態值
      const statusIndex = headerColumns.indexOf('readingStatus')
      expect(statusIndex).toBeGreaterThanOrEqual(0)
      dataLines.forEach(line => {
        const cells = line.split(',')
        const statusValue = (cells[statusIndex] || '').trim()
        expect(READING_STATUS_ENUM).toContain(statusValue)
      })
    })
  })
})
