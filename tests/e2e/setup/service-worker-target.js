/**
 * service-worker-target.js — E2E 取得 Extension Service Worker target 的單一 SSOT
 *
 * 負責功能：
 * - 等待並取得已載入 Extension 的 Service Worker Puppeteer Target
 *
 * 設計考量：
 * - Manifest V3 Extension 以 Service Worker 取代背景頁面，target.type() 為
 *   'service_worker'；url 以 'chrome-extension://' 前綴判定屬本 Extension。
 * - 回傳 Target（非 worker）：target 是所有 caller 的最小共同單位。
 *   getExtensionId 只需 target.url()，若此處強制 target.worker() 會多建立
 *   一個不必要的 CDP worker session。需要 worker context 的 caller 自行呼叫
 *   target.worker()。
 * - 本函式只收斂 waitForTarget predicate + timeout，不含 try/catch。
 *   3 處 caller 各自的 try/catch 與專屬錯誤契約（前綴、ErrorCodes、
 *   originalCode）由 caller 保留，本 SSOT 不介入錯誤包裝。
 * - SW 可能因 idle 被回收，target 每次重新取得，不快取。
 *
 * 使用情境：
 * - tests/e2e/setup/extension-setup.js 的 getExtensionId / getBackgroundPage
 * - tests/e2e/browser/helpers/storage-reader.js 的 getServiceWorker
 */

/**
 * 等待並取得 Extension Service Worker 的 Puppeteer Target
 *
 * @param {import('puppeteer').Browser} browser - Puppeteer Browser 實例
 * @param {number} [timeout=10000] - 等待 SW target 的逾時毫秒數
 * @returns {Promise<import('puppeteer').Target>} Service Worker target
 * @throws {Error} waitForTarget 逾時時拋出原生錯誤；錯誤包裝由 caller 負責
 */
async function acquireServiceWorkerTarget (browser, timeout = 10000) {
  return browser.waitForTarget(
    target => target.type() === 'service_worker' &&
              target.url().startsWith('chrome-extension://'),
    { timeout }
  )
}

module.exports = {
  acquireServiceWorkerTarget
}
