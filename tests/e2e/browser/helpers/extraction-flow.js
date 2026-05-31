/**
 * extraction-flow.js — 真實瀏覽器 E2E 的提取流程 helper
 *
 * 負責功能：
 * - 以 Puppeteer request interception 將 fixture HTML 服務於 readmoo.com 域名，
 *   使 Extension content script 自動注入（content_scripts matches *://*.readmoo.com/*）
 * - 導航 fixture 頁、等待 content script 就緒
 * - 觸發提取流程並等待 storage 寫入完成
 * - 收集 JS runtime error（排除資源 network error）
 *
 * 設計考量：
 * - Extension content script 僅注入 readmoo.com 域名（manifest content_scripts
 *   matches），file:// fixture 無法觸發注入。改用 request interception 讓 fixture
 *   在 https://readmoo.com/library 服務，content script 自動注入，完整 pipeline
 *   （content script DOM 提取 -> background -> storage）跑通，且不修改產品 manifest。
 * - 提取觸發採 Service Worker 對 fixture tab 直送 START_EXTRACTION 訊息。
 *   原規格（Phase 3a M1）指定 popup 點 #extractBtn，但 Puppeteer 環境下 popup 為
 *   獨立分頁（非真實 action popup 覆蓋層），popup 的 checkCurrentTab() 會把 popup
 *   自身判定為 active tab，導致 isReadmoo=false、#extractBtn 保持 disabled。SW
 *   直送 START_EXTRACTION 仍經完整 content script pipeline，僅跳過 popup UI button 層。
 * - console error 監聽排除資源載入失敗（fixture cover-img 為假 CDN URL，會產生
 *   network error，非 JS runtime error，不應誤觸 model regression 判定 — TD-5）。
 *
 * 使用情境：
 * - tests/e2e/browser/ 的 G2/G4/G5 共用提取前置流程。
 * - helper 不持有 mutable 狀態，每個 test case 重啟 browser 後可獨立呼叫。
 */

const fs = require('fs')
const path = require('path')
const { waitForBooksStable, getServiceWorker } = require('./storage-reader')
const { DEFAULT_NAV_TIMEOUT, CONTENT_SCRIPT_READY_TIMEOUT } = require('./timeouts')

// fixture 服務的目標 URL（content script matches *://*.readmoo.com/* 會注入）
const FIXTURE_URL = 'https://readmoo.com/library'
const FIXTURE_HTML_PATH = path.resolve(__dirname, '../../fixtures/readmoo-mock-page.html')
const FIXTURE_BOOK_COUNT = 5

/**
 * 為 page 設定 request interception，將 fixture HTML 服務於 readmoo.com
 *
 * - https://readmoo.com/library -> 回傳 fixture HTML
 * - 其他 readmoo.com 請求 -> 回傳空白頁（避免真實網路請求）
 * - 其餘請求 -> 放行（fixture 的 cover-img 假 CDN URL 會走此路徑並 404，屬預期）
 *
 * @param {import('puppeteer').Page} page - Puppeteer Page 實例
 * @returns {Promise<void>}
 */
async function setupReadmooInterception (page) {
  const fixtureHtml = fs.readFileSync(FIXTURE_HTML_PATH, 'utf8')
  await page.setRequestInterception(true)
  page.on('request', req => {
    const url = req.url()
    if (url.startsWith(FIXTURE_URL)) {
      req.respond({
        status: 200,
        contentType: 'text/html; charset=utf-8',
        body: fixtureHtml
      })
    } else if (url.startsWith('https://readmoo.com') || url.startsWith('http://readmoo.com')) {
      req.respond({
        status: 200,
        contentType: 'text/html',
        body: '<!DOCTYPE html><html><body></body></html>'
      })
    } else {
      // fixture cover-img 假 CDN URL 走此路徑（會 404，屬預期，不影響提取）
      req.continue()
    }
  })
}

/**
 * 判斷 console 訊息是否為應計入的 JS runtime error
 *
 * 排除資源載入失敗（network error）：fixture cover-img 用假 CDN URL，載入時會
 * 產生 "Failed to load resource" 類訊息，屬 network error 非 JS runtime error，
 * 不應誤判為提取 pipeline 的 JS 錯誤（TD-5）。
 *
 * @param {import('puppeteer').ConsoleMessage} msg - console 訊息
 * @returns {boolean} 是否為應計入的 JS runtime error
 */
function isJsRuntimeError (msg) {
  if (msg.type() !== 'error') {
    return false
  }
  const text = msg.text() || ''
  // 資源載入失敗特徵（network error，非 JS 錯誤）
  const networkErrorPatterns = [
    'Failed to load resource',
    'net::ERR_',
    'the server responded with a status of'
  ]
  return !networkErrorPatterns.some(pattern => text.includes(pattern))
}

/**
 * 導航 fixture 頁並等待 content script 就緒
 *
 * @param {Object} setup - 已 setup() 的 ExtensionTestSetup 測試環境
 * @returns {Promise<{ jsErrors: string[] }>} 含 JS error 收集器
 * @throws {Error} 導航或 content script 就緒失敗時拋錯（[SETUP] 前綴）
 */
async function navigateToFixture (setup) {
  const page = setup.page
  const jsErrors = []

  // 收集 page 端 JS runtime error（排除 network error）
  page.on('console', msg => {
    if (isJsRuntimeError(msg)) {
      jsErrors.push(`[page] ${msg.text()}`)
    }
  })
  page.on('pageerror', error => {
    jsErrors.push(`[pageerror] ${error.message}`)
  })

  await setupReadmooInterception(page)

  try {
    await page.goto(FIXTURE_URL, { waitUntil: 'domcontentloaded', timeout: DEFAULT_NAV_TIMEOUT })
  } catch (error) {
    throw new Error(`[SETUP] 導航 fixture 失敗: ${error.message}`)
  }

  // 驗證 fixture DOM：正好 5 本 .library-item
  const libraryItemCount = await page.$$eval('.library-item', els => els.length)
  if (libraryItemCount !== FIXTURE_BOOK_COUNT) {
    throw new Error(
      `[SETUP] fixture .library-item 數量異常：期望 ${FIXTURE_BOOK_COUNT}，實際 ${libraryItemCount}`
    )
  }

  // 等待 content script 注入並就緒（SW PING 確認）
  await waitForContentScriptReady(setup)

  return { jsErrors }
}

/**
 * 等待 fixture tab 的 content script 注入並就緒
 *
 * 透過 Service Worker 對 fixture tab 送 PING，content script 注入並回應 success
 * 才視為就緒。polling 取代固定 sleep。
 *
 * @param {Object} setup - ExtensionTestSetup 測試環境
 * @param {Object} [options] - 選項
 * @param {number} [options.timeout=CONTENT_SCRIPT_READY_TIMEOUT] - 逾時毫秒數
 * @param {number} [options.interval=500] - polling 間隔毫秒數
 * @returns {Promise<void>}
 * @throws {Error} content script 逾時未就緒時拋錯（[SETUP] 前綴）
 */
async function waitForContentScriptReady (setup, options = {}) {
  const timeout = options.timeout || CONTENT_SCRIPT_READY_TIMEOUT
  const interval = options.interval || 500
  const deadline = Date.now() + timeout
  const worker = await getServiceWorker(setup.browser)

  while (Date.now() < deadline) {
    const ready = await worker.evaluate(async () => {
      const tabs = await chrome.tabs.query({})
      const target = tabs.find(t => t.url && t.url.includes('readmoo.com/library'))
      if (!target) {
        return false
      }
      try {
        const resp = await chrome.tabs.sendMessage(target.id, { type: 'PING' })
        return !!(resp && resp.success && resp.ready)
      } catch {
        return false
      }
    })
    if (ready) {
      return
    }
    await new Promise(resolve => setTimeout(resolve, interval))
  }

  throw new Error(`[SETUP] content script 未在 ${timeout}ms 內就緒`)
}

/**
 * 觸發提取流程並等待 storage 寫入完成
 *
 * 採 Service Worker 對 fixture tab 直送 START_EXTRACTION 訊息，經完整 content
 * script pipeline（content script DOM 提取 -> background -> storage）。
 *
 * @param {Object} setup - ExtensionTestSetup 測試環境
 * @param {Object} [options] - 選項
 * @param {number} [options.expectedCount=5] - 期望提取書數
 * @returns {Promise<Array>} 提取後 storage 中的書籍陣列
 * @throws {Error} 提取觸發失敗時拋錯（[SETUP] 前綴）
 */
async function triggerExtraction (setup, options = {}) {
  const expectedCount = options.expectedCount || FIXTURE_BOOK_COUNT
  const worker = await getServiceWorker(setup.browser)

  const startResult = await worker.evaluate(async () => {
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

  if (!startResult || !startResult.success) {
    throw new Error(
      `[SETUP] 觸發提取失敗: ${startResult ? startResult.error : '未知錯誤'}`
    )
  }

  // 等待 storage 寫入達期望書數
  return await waitForBooksStable(setup.browser, expectedCount)
}

/**
 * 執行完整提取流程：導航 fixture -> 等待就緒 -> 觸發提取 -> 等待 storage
 *
 * 供 G2/G4/G5 共用。每次呼叫前 setup 須已 setup() 完成。
 *
 * @param {Object} setup - ExtensionTestSetup 測試環境
 * @returns {Promise<{ books: Array, jsErrors: string[] }>} 提取結果與 JS error 清單
 */
async function runExtraction (setup) {
  const { jsErrors } = await navigateToFixture(setup)
  const books = await triggerExtraction(setup)
  return { books, jsErrors }
}

/**
 * 在 setup 已導航過 fixture 後再次重新導航並觸發提取
 *
 * 用於去重 regression 等需驗證「同一 setup 連續多次提取」的測試場景。與
 * runExtraction 差異：
 * - runExtraction 含 navigateToFixture（會 setupReadmooInterception + 註冊 console
 *   error 監聽器），適用於 fresh setup 的首次提取。
 * - reExtract 假設 setup 已完成首次 navigateToFixture，僅重新導航至 fixture URL、
 *   等待 content script 重新注入就緒、觸發提取；不重複註冊 console 監聽器、不重設
 *   request interception。
 *
 * @param {Object} setup - 已執行過 navigateToFixture 的 ExtensionTestSetup 測試環境
 * @param {Object} [options] - 選項
 * @param {number} [options.expectedCount=5] - 期望提取書數（傳給 triggerExtraction）
 * @returns {Promise<Array>} 提取後 storage 中的書籍陣列
 * @throws {Error} 導航或提取觸發失敗時拋錯（[SETUP] 前綴）
 */
async function reExtract (setup, options = {}) {
  try {
    await setup.page.goto(FIXTURE_URL, { waitUntil: 'domcontentloaded', timeout: DEFAULT_NAV_TIMEOUT })
  } catch (error) {
    throw new Error(`[SETUP] 二次導航 fixture 失敗: ${error.message}`)
  }
  await waitForContentScriptReady(setup)
  return await triggerExtraction(setup, options)
}

module.exports = {
  FIXTURE_URL,
  FIXTURE_HTML_PATH,
  FIXTURE_BOOK_COUNT,
  setupReadmooInterception,
  isJsRuntimeError,
  navigateToFixture,
  waitForContentScriptReady,
  triggerExtraction,
  runExtraction,
  reExtract
}
