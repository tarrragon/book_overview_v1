/**
 * timeouts.js — 真實瀏覽器 E2E timeout 具名常數集中宣告
 *
 * 負責功能：
 * - 將 tests/e2e/browser/ 內散落的 timeout magic number 收斂為具名常數
 * - 以語意化命名揭露每個 timeout 的用途，降低閱讀者推測成本
 *
 * 設計考量：
 * - W1-008 Phase 4 Redundancy 視角識別：30000 出現於導覽、提取就緒等待、Overview
 *   渲染等不同語意場景，混用同一字面值降低可讀性。常數命名以「用途」為主軸，
 *   而非單純數值別名，使閱讀測試碼時能立即理解 timeout 為何被選用。
 * - JEST_TEST_TIMEOUT 為 jest test/beforeAll 整檔逾時的設定值，與 puppeteer page
 *   層 timeout 語意不同：前者控制整個 test case / beforeAll hook 的最大執行時間，
 *   後者控制單一頁面操作（goto / waitForSelector）的等待上限。混用會誤導閱讀者
 *   對「為何 90000 比 30000 大」的判斷。
 * - 常數採 module.exports 統一匯出，呼叫端解構引入，避免在各 helper 內重複宣告
 *   而造成單一值多處維護。
 *
 * 使用情境：
 * - tests/e2e/browser/helpers/ 內所有 helper 的 timeout 預設值。
 * - tests/e2e/browser/*.e2e.test.js 內 jest test/beforeAll timeout 參數。
 */

/**
 * page.goto / waitForSelector 等 puppeteer 頁面層操作的預設逾時（毫秒）
 *
 * 適用：fixture 導航、Overview 頁載入、DOM selector 等待
 */
const DEFAULT_NAV_TIMEOUT = 30000

/**
 * content script 就緒等待的預設逾時（毫秒）
 *
 * 適用：waitForContentScriptReady polling 上限
 */
const CONTENT_SCRIPT_READY_TIMEOUT = 30000

/**
 * storage 寫入穩定等待的預設逾時（毫秒）
 *
 * 適用：waitForBooksStable polling 上限
 */
const STORAGE_STABLE_TIMEOUT = 30000

/**
 * Overview 頁面書籍清單渲染等待的預設逾時（毫秒）
 *
 * 適用：Overview 整體渲染流程（含 storage 讀取 + DOM 渲染）的 jest test timeout
 */
const OVERVIEW_RENDER_TIMEOUT = 60000

/**
 * jest test / beforeAll hook 的整體逾時（毫秒）
 *
 * 適用：含完整提取 pipeline（含 SW 建立、content script 注入、storage polling）
 * 的 test case 或 beforeAll hook 的最大執行時間上限
 */
const JEST_TEST_TIMEOUT = 90000

/**
 * Extension Service Worker 啟動（取得 SW target）的預設逾時（毫秒）
 *
 * 適用：tests/e2e/setup/extension-setup.js 內 getExtensionId / getBackgroundPage
 * 等待 chrome-extension:// 的 service_worker target 出現的上限。
 *
 * 設計考量：
 * - 原硬編碼為 10000ms（W4-005.1 前），實測在系統負載 / cold-start 情境下不足，
 *   穩定性實測（W4-005.1 二分定位）9 run 中 3 run 因 10s 不足產生
 *   「取得 Extension ID 失敗 Timed out after waiting 10000ms」之 false negative。
 * - 拉長至 30000ms 對齊 DEFAULT_NAV_TIMEOUT 等其他 setup 階段 timeout，
 *   GREEN 路徑 SW 取得仍 <100ms（無 latency 影響），僅在邊緣 cold-start 情境
 *   爭取更多重試空間。
 * - 與 JEST_TEST_TIMEOUT (90000) 留 60s buffer：beforeAll 即使遇 cold-start，
 *   30s SW + 60s 提取 pipeline 仍在整體 90s 上限內。
 */
const SW_LAUNCH_TIMEOUT = 30000

module.exports = {
  DEFAULT_NAV_TIMEOUT,
  CONTENT_SCRIPT_READY_TIMEOUT,
  STORAGE_STABLE_TIMEOUT,
  OVERVIEW_RENDER_TIMEOUT,
  JEST_TEST_TIMEOUT,
  SW_LAUNCH_TIMEOUT
}
