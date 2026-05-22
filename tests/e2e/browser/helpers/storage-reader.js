/**
 * storage-reader.js — 真實瀏覽器 E2E 的 Service Worker storage 讀取 helper
 *
 * 負責功能：
 * - 取得 Extension Service Worker 的 worker context
 * - 在 SW context 內讀取 chrome.storage.local 的 readmoo_books
 * - 雙形態容錯解析書籍陣列（物件含 .books / 直接陣列）
 * - polling 等待書數穩定（禁止固定 sleep，遵循 test-assertion-design-rules）
 *
 * 設計考量：
 * - chrome.storage.local 由 Service Worker 持有，必須在 SW worker context 讀取，
 *   不可在 content / popup page context 讀（權限與時序不一致）。
 * - SW 可能因 idle 被回收，worker target 每次重新取得，不快取。
 * - readmoo_books 可能為 { books: [...], extractionCount: N } 物件，亦可能為
 *   直接陣列（tag-storage-adapter.js:129 確認雙形態），讀取時兩種皆容錯。
 *
 * 使用情境：
 * - tests/e2e/browser/ 真實瀏覽器 E2E 測試讀取提取結果驗證 model 斷言。
 */

const { acquireServiceWorkerTarget } = require('../../setup/service-worker-target')

const STORAGE_KEY = 'readmoo_books'

/**
 * 取得 Extension Service Worker 的 worker context
 *
 * SW target 取得邏輯收斂於 setup/service-worker-target.js（單一 SSOT）；
 * 本函式保留 [SETUP] 前綴錯誤包裝（屬環境問題的可觀測契約）。
 *
 * @param {import('puppeteer').Browser} browser - Puppeteer Browser 實例
 * @param {number} timeout - 等待 SW target 的逾時毫秒數
 * @returns {Promise<import('puppeteer').WebWorker>} SW worker context
 * @throws {Error} 逾時未取得 SW 時拋錯（[SETUP] 前綴，屬環境問題）
 */
async function getServiceWorker (browser, timeout = 10000) {
  try {
    const swTarget = await acquireServiceWorkerTarget(browser, timeout)
    return await swTarget.worker()
  } catch (error) {
    throw new Error(`[SETUP] 取得 Service Worker 失敗: ${error.message}`)
  }
}

/**
 * 從 Service Worker 的 chrome.storage.local 讀取書籍陣列
 *
 * 雙形態容錯：readmoo_books 可能是物件（含 .books）或直接陣列。
 *
 * @param {import('puppeteer').Browser} browser - Puppeteer Browser 實例
 * @returns {Promise<Array>} 書籍物件陣列；無資料時回傳空陣列
 */
async function readBooksFromStorage (browser) {
  const worker = await getServiceWorker(browser)

  // 在 SW context 內讀 storage；callback 形式的 get 包成 Promise
  const raw = await worker.evaluate((key) => {
    return new Promise(resolve => {
      chrome.storage.local.get([key], result => resolve(result[key]))
    })
  }, STORAGE_KEY)

  // 雙形態容錯
  if (raw === null || raw === undefined) {
    return []
  }
  if (Array.isArray(raw)) {
    return raw
  }
  if (Array.isArray(raw.books)) {
    return raw.books
  }
  return []
}

/**
 * polling 等待 storage 書數達到期望值
 *
 * 用 polling 取代固定 sleep（test-assertion-design-rules：禁止 setTimeout 固定等待）。
 *
 * @param {import('puppeteer').Browser} browser - Puppeteer Browser 實例
 * @param {number} expectedCount - 期望的書籍數量
 * @param {Object} [options] - 選項
 * @param {number} [options.timeout=30000] - 逾時毫秒數
 * @param {number} [options.interval=500] - polling 間隔毫秒數
 * @returns {Promise<Array>} 達到期望數量的書籍陣列
 * @throws {Error} 逾時未達期望數量時拋錯（[SETUP] 前綴，屬環境/pipeline 前置問題）
 */
async function waitForBooksStable (browser, expectedCount, options = {}) {
  const timeout = options.timeout || 30000
  const interval = options.interval || 500
  const deadline = Date.now() + timeout

  let lastCount = -1
  while (Date.now() < deadline) {
    const books = await readBooksFromStorage(browser)
    lastCount = books.length
    if (books.length === expectedCount) {
      return books
    }
    await new Promise(resolve => setTimeout(resolve, interval))
  }

  throw new Error(
    `[SETUP] storage 未在 ${timeout}ms 內達到 ${expectedCount} 本書` +
    `（最後一次讀取為 ${lastCount} 本）`
  )
}

/**
 * 清空 Service Worker 的 readmoo_books storage
 *
 * 用於測試前置重置，確保每次提取從乾淨狀態開始。
 *
 * @param {import('puppeteer').Browser} browser - Puppeteer Browser 實例
 * @returns {Promise<void>}
 */
async function clearBooksStorage (browser) {
  const worker = await getServiceWorker(browser)
  await worker.evaluate((key) => {
    return new Promise(resolve => {
      chrome.storage.local.remove([key], () => resolve())
    })
  }, STORAGE_KEY)
}

module.exports = {
  STORAGE_KEY,
  getServiceWorker,
  readBooksFromStorage,
  waitForBooksStable,
  clearBooksStorage
}
