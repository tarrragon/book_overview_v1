/**
 * Readmoo 書庫數據提取器 - Popup Interface Script
 *
 * 負責功能：
 * - 處理 Popup 界面的使用者互動
 * - 與 Background Service Worker 通訊
 * - 顯示即時狀態和進度更新
 * - 提供擴展設定和操作控制
 *
 * 設計考量：
 * - 事件驅動的界面更新
 * - 錯誤處理和使用者回饋
 * - 響應式設計支援
 * - 無障礙使用考量
 *
 * 處理流程：
 * 1. 初始化 DOM 元素引用
 * 2. 檢查 Background Service Worker 狀態
 * 3. 檢查當前標籤頁是否為 Readmoo 頁面
 * 4. 設定事件監聽器
 * 5. 定期更新狀態
 *
 * 使用情境：
 * - 使用者點擊 Chrome Extension 圖標時載入
 * - 提供主要的使用者操作界面
 */

// W4-006.2 重構（合併 popup 4 檔為單一 entry，esbuild 自動 bundle）：
//
// 將原本以獨立 <script> tag 載入的三個 popup helper 改為 require，由 esbuild
// 在 build 階段內聯到 popup.js IIFE，徹底消除 classic script 跨檔 global lexical
// record 衝突（W1-117 引入的 `let Logger` 與 var Logger 重複宣告 SyntaxError）。
//
// require 必須在 Logger/ErrorCodes/MessageDictionary 之前執行：
// - bundled 環境：三個 helper 各自的 const Logger 在 IIFE closure scope 獨立，
//   不影響本檔的 Logger
// - Node test 環境（jest jsdom）：require 觸發三 helper 載入並執行 window.Popup*
//   注入，使本檔後續 typeof PopupErrorHandler / typeof PopupDiagnosticEnhancer /
//   typeof PopupInitializationTracker 檢查可命中
//
// 設計考量（W4-006.1 多視角審查）：
// - 保留 try-catch fallback：若 require 路徑失敗（如 cjs require resolution 異常），
//   不阻擋 popup.js 整檔執行，由 helper 自身的 window.* 注入提供 fallback
// - 註冊到 window 由各 helper 內部負責（window.PopupErrorHandler 等），本檔不重複
if (typeof require !== 'undefined') {
  try {
    require('./popup-error-handler')
    require('./popup-diagnostic-enhancer')
    require('./popup-initialization-tracker')
  } catch (e) {
    // require 失敗時 helper 仍可由 <script> tag fallback 載入（HTML 過渡期）
    // 或由測試環境另行 mock window.Popup* 注入
  }
}

// 統一日誌管理系統 - 支援多環境載入（esbuild bundle / Node.js 測試環境）
//
// W4-006.2 重構：
// - 原本 `var Logger` + typeof guard 是對抗 classic script 跨檔同名宣告，
//   esbuild bundle 後 IIFE closure scope 隔離，可改用 const 直接宣告
// - require fallback chain：require(...).Logger || window.Logger || stub class
const Logger = (() => {
  if (typeof require !== 'undefined') {
    try {
      return require('src/core/logging/Logger').Logger
    } catch (e) {
      return (typeof window !== 'undefined' && window.Logger) || class { info () {} warn () {} error () {} debug () {} }
    }
  }
  return (typeof window !== 'undefined' && window.Logger) || class { info () {} warn () {} error () {} debug () {} }
})()

const ErrorCodes = (() => {
  if (typeof require !== 'undefined') {
    try {
      return require('src/core/errors/ErrorCodes').ErrorCodes
    } catch (e) {
      return (typeof window !== 'undefined' && window.ErrorCodes) || {
        UNKNOWN_ERROR: 'UNKNOWN_ERROR',
        CHROME_ERROR: 'CHROME_ERROR',
        OPERATION_ERROR: 'OPERATION_ERROR'
      }
    }
  }
  return (typeof window !== 'undefined' && window.ErrorCodes) || {
    UNKNOWN_ERROR: 'UNKNOWN_ERROR',
    CHROME_ERROR: 'CHROME_ERROR',
    OPERATION_ERROR: 'OPERATION_ERROR'
  }
})()

let MessageDictionary
if (typeof require !== 'undefined') {
  try {
    ({ MessageDictionary } = require('src/core/messages/MessageDictionary'))
  } catch (e) {
    MessageDictionary = (typeof window !== 'undefined' && window.MessageDictionary) || class {}
  }
} else {
  MessageDictionary = (typeof window !== 'undefined' && window.MessageDictionary) || class {}
}

// Design System 配色常數
let COLORS
if (typeof require !== 'undefined') {
  try {
    ({ COLORS } = require('src/core/design-system/colors.js'))
  } catch (e) {
    COLORS = null
  }
} else {
  COLORS = null
}

// ImportPanel — JSON 匯入 UI 控制器
let ImportPanel
if (typeof require !== 'undefined') {
  try {
    ({ ImportPanel } = require('src/popup/components/import-panel'))
  } catch (e) {
    ImportPanel = (typeof window !== 'undefined' && window.ImportPanel) || null
  }
} else {
  ImportPanel = (typeof window !== 'undefined' && window.ImportPanel) || null
}

// ui-factory — 匯入結果 / 匯入錯誤卡片以工廠函式動態建立（ticket 1.2.0-W2-003.2）
let uiFactory
if (typeof require !== 'undefined') {
  try {
    uiFactory = require('src/popup/components/ui-factory')
  } catch (e) {
    uiFactory = (typeof window !== 'undefined' && window.PopupUIFactory) || null
  }
} else {
  uiFactory = (typeof window !== 'undefined' && window.PopupUIFactory) || null
}

// bookstore-config — 書城清單 SSOT（1.4.2-W1-001）
let BOOKSTORE_LIST
if (typeof require !== 'undefined') {
  try {
    ({ BOOKSTORE_LIST } = require('./constants/bookstore-config'))
  } catch (e) {
    BOOKSTORE_LIST = []
  }
} else {
  BOOKSTORE_LIST = []
}

// 初始化 Popup Logger
const popupMessages = new MessageDictionary({
  POPUP_INTERFACE_LOADED: 'Popup Interface 載入完成',
  POPUP_SCRIPT_LOADED: '[OK] Popup Script 載入完成',
  VERSION_ERROR: '無法獲取版本號',
  EXTRACTION_ERROR: '[FAIL] 提取錯誤詳情',
  BACKGROUND_STATUS_CHECK: '[CHECK] 正在檢查 Background Service Worker 狀態...',
  TEST_ENV_PROCESSING: '[LOG] Test environment - processing mock response',
  BACKGROUND_STATUS_OK: '[OK] Background Service Worker 狀態正常',
  EVENT_SYSTEM_STATUS: '[STATS] 事件系統狀態',
  BACKGROUND_CONNECTION_FAILED: '[FAIL] Background Service Worker 連線失敗',
  CONTENT_SCRIPT_NOT_READY: 'Content Script 尚未就緒',
  TAB_CHECK_ERROR: '檢查標籤頁時發生錯誤',
  EXTRACTION_PROCESS_ERROR: '提取過程發生錯誤',
  LIBRARY_OVERVIEW_OPEN: '開啟書庫總覽頁面...',
  LIBRARY_OVERVIEW_ERROR: '[FAIL] 無法開啟書庫頁面',
  POPUP_INIT_START: '[START] 開始初始化 Popup Interface',
  POPUP_INIT_COMPLETE: '[OK] Popup Interface 初始化完成',
  POPUP_INIT_ERROR: '[FAIL] 初始化過程發生錯誤',
  DIAGNOSTIC_INIT_FAILED: '[WARN] 診斷增強器初始化失敗',
  DIAGNOSTIC_INIT_SUCCESS: '[OK] 診斷增強器初始化成功',
  HEALTH_CHECK_ERROR: '健康檢查錯誤',
  POPUP_GLOBAL_ERROR: '[FAIL] Popup Interface 錯誤',
  IMPORT_PANEL_MOUNT_FAILED: '[WARN] 匯入卡片掛載失敗（跨 realm 測試環境降級）'
})

const popupLogger = new Logger('PopupInterface', 'INFO', popupMessages)

popupLogger.info('POPUP_INTERFACE_LOADED')

// ==================== 常數定義 ====================

/* global PopupInitializationTracker, PopupErrorHandler, PopupDiagnosticEnhancer */

// UI 文字 / 佈局常數集中於 src/popup/constants/（見 CLAUDE.md 6.x）。
// 此處從常數檔引用並映射回既有變數名，保持下游使用點與 window re-export 不變。
const popupConstants = (() => {
  if (typeof require !== 'undefined') {
    try {
      return require('./constants')
    } catch (e) {
      return (typeof window !== 'undefined' && window.PopupConstants) || null
    }
  }
  return (typeof window !== 'undefined' && window.PopupConstants) || null
})()

/**
 * 狀態類型常數
 */
const STATUS_TYPES = popupConstants.STATUS_TYPES

/**
 * 訊息類型常數
 */
const MESSAGE_TYPES = popupConstants.MESSAGE_TYPES

/**
 * 預設訊息常數
 *
 * 由 constants/ui-text.js 的功能分類重組為扁平 MESSAGES，維持既有使用點鍵名。
 */
const MESSAGES = {
  SETTINGS_PLACEHOLDER: popupConstants.DIALOG_TEXT.SETTINGS_PLACEHOLDER,
  HELP_TEXT: popupConstants.DIALOG_TEXT.HELP_TEXT,
  STATUS_CHECKING: popupConstants.STATUS_TEXT.CHECKING,
  STATUS_INITIALIZING: popupConstants.STATUS_TEXT.INITIALIZING,
  CONTENT_SCRIPT_LOADING: popupConstants.STATUS_TEXT.CONTENT_SCRIPT_LOADING,
  CONTENT_SCRIPT_RELOAD_HINT: popupConstants.STATUS_TEXT.CONTENT_SCRIPT_RELOAD_HINT,
  NON_READMOO_PAGE: popupConstants.STATUS_TEXT.NON_READMOO_PAGE,
  NON_READMOO_HINT: popupConstants.STATUS_TEXT.NON_READMOO_HINT,
  EXTRACTION_IN_PROGRESS: popupConstants.EXTRACTION_TEXT.IN_PROGRESS,
  EXTRACTION_HINT: popupConstants.EXTRACTION_TEXT.HINT
}

/**
 * 配置常數
 */
const CONFIG = {
  STATUS_UPDATE_INTERVAL: popupConstants.STATUS_CONFIG.STATUS_UPDATE_INTERVAL_MS,
  READMOO_DOMAIN: popupConstants.STATUS_CONFIG.READMOO_DOMAIN
}

/**
 * popup↔SW 握手重試配置（1.1.0-W1-019 A+C 方案）
 */
const HANDSHAKE_CONFIG = popupConstants.HANDSHAKE_CONFIG

/**
 * 以集中常數注入 popup.html 的靜態 UI 文字
 *
 * constants/ui-text.js 為文字的單一事實來源；popup.html 中保留同值文字僅作為
 * 無 JS fallback。缺對應 DOM 元素時逐項 guard 跳過，不阻斷初始化。
 */
function applyStaticUIText () {
  const { HEADER_TEXT, ACTION_TEXT, EXTRACTION_TEXT, RESULTS_TEXT, ERROR_TEXT } = popupConstants

  const setText = (id, text) => {
    const el = document.getElementById(id)
    if (el) el.textContent = text
  }
  const setAria = (id, label) => {
    const el = document.getElementById(id)
    if (el) el.setAttribute('aria-label', label)
  }

  // 操作按鈕
  setText('settingsBtn', ACTION_TEXT.SETTINGS)
  setText('helpBtn', ACTION_TEXT.HELP)
  setText('viewLibraryBtn', ACTION_TEXT.VIEW_LIBRARY)
  setAria('viewLibraryBtn', ACTION_TEXT.VIEW_LIBRARY_ARIA)
  setText('importBtn', ACTION_TEXT.IMPORT)
  setAria('importBtn', ACTION_TEXT.IMPORT_ARIA)
  setText('diagnosticBtn', ACTION_TEXT.DIAGNOSTIC)
  setAria('viewResultsBtn', RESULTS_TEXT.VIEW_RESULTS_ARIA)

  // extractBtn 文字由狀態管理動態控制，初始值對齊常數
  const extractBtn = document.getElementById('extractBtn')
  if (extractBtn) extractBtn.textContent = ACTION_TEXT.EXTRACT

  // 標頭（header 內 h1 / p 無 id，以 querySelector 定位）
  const headerTitle = document.querySelector('.header h1')
  if (headerTitle) headerTitle.textContent = HEADER_TEXT.TITLE
  const headerSubtitle = document.querySelector('.header p')
  if (headerSubtitle) headerSubtitle.textContent = HEADER_TEXT.SUBTITLE

  // 區段標題 / 錯誤標題（無 id，querySelector 定位確保常數生效）
  const progressHeader = document.querySelector('#progressContainer .progress-header strong')
  if (progressHeader) progressHeader.textContent = EXTRACTION_TEXT.PROGRESS_HEADER
  const resultsHeader = document.querySelector('#resultsContainer .results-header strong')
  if (resultsHeader) resultsHeader.textContent = RESULTS_TEXT.HEADER
  const errorHeader = document.querySelector('#errorContainer .error-header strong')
  if (errorHeader) errorHeader.textContent = ERROR_TEXT.HEADER

  // 錯誤區按鈕
  setText('retryBtn', ERROR_TEXT.RETRY)
  setText('reloadExtensionBtn', ERROR_TEXT.RELOAD_EXTENSION)
  setText('forceReloadBtn', ERROR_TEXT.FORCE_RELOAD)
  setText('openExtensionPageBtn', ERROR_TEXT.OPEN_EXTENSION_PAGE)
  setText('exportBtn', RESULTS_TEXT.EXPORT)
  setText('viewResultsBtn', RESULTS_TEXT.VIEW_RESULTS)
}

// ==================== DOM 元素管理 ====================

/**
 * DOM 元素引用
 *
 * 負責功能：
 * - 集中管理所有 DOM 元素引用
 * - 提供統一的元素存取方式
 */
const elements = {
  statusDot: document.getElementById('statusDot'),
  statusText: document.getElementById('statusText'),
  statusInfo: document.getElementById('statusInfo'),
  extractBtn: document.getElementById('extractBtn'),
  settingsBtn: document.getElementById('settingsBtn'),
  helpBtn: document.getElementById('helpBtn'),
  viewLibraryBtn: document.getElementById('viewLibraryBtn'),
  importBtn: document.getElementById('importBtn'),
  importFileInput: document.getElementById('importFileInput'),
  // 匯入結果 / 匯入錯誤卡片改由 buildImportPanelElements() 以 ui-factory 動態建立
  // 並掛載於 importPanelMount，不再經 getElementById（ticket 1.2.0-W2-003.2）。
  pageInfo: document.getElementById('pageInfo'),
  bookCount: document.getElementById('bookCount'),
  extensionStatus: document.getElementById('extensionStatus'),

  // 進度顯示元素
  progressContainer: document.getElementById('progressContainer'),
  progressBar: document.getElementById('progressBar'),
  progressText: document.getElementById('progressText'),
  progressPercentage: document.getElementById('progressPercentage'),

  // 結果展示元素
  resultsContainer: document.getElementById('resultsContainer'),
  extractedBookCount: document.getElementById('extractedBookCount'),
  extractionTime: document.getElementById('extractionTime'),
  successRate: document.getElementById('successRate'),
  exportBtn: document.getElementById('exportBtn'),
  viewResultsBtn: document.getElementById('viewResultsBtn'),

  // 錯誤訊息元素
  errorContainer: document.getElementById('errorContainer'),
  errorMessage: document.getElementById('errorMessage'),
  retryBtn: document.getElementById('retryBtn'),
  reportBtn: document.getElementById('reportBtn'),
  initReportBtn: document.getElementById('initReportBtn'),
  systemHealthCheckBtn: document.getElementById('systemHealthCheckBtn'),

  // 版本顯示元素
  versionDisplay: document.getElementById('versionDisplay')
}

// ==================== 全域變數 ====================

/**
 * 全域變數宣告
 */
let errorHandler = null
let diagnosticEnhancer = null
let initializationTracker = null

/**
 * 終態旗標（W1-062.1）
 *
 * 業務情境：
 * - W1-062 修復 storage onChanged 後正確顯示「提取成功 N 本書籍」終態
 * - setInterval(periodicStatusUpdate, 3000) 每 3 秒呼叫 checkCurrentTab() 會將
 *   status 覆寫回「就緒/Content Script 連線正常」，使終態僅顯示不到 3 秒
 *
 * 旗標語意：
 * - false（預設）：popup 處於 polling 模式，periodicStatusUpdate 可自由更新 status
 * - true：popup 處於終態（提取成功/失敗），periodicStatusUpdate 跳過 status 覆寫
 *   但仍執行 chrome.tabs.query 健康探測
 *
 * 變更時機：
 * - 設為 true：setupExtractionCompletionListener 收到 readmoo_books 變更時、
 *   startExtraction 同步 response.success 時、startExtraction catch 區塊
 * - 設為 false：startExtraction 函式開頭（用戶再次點擊提取，重置回 polling）
 */
let isFinalStatus = false

// ==================== 狀態管理 ====================

/**
 * 更新狀態顯示
 *
 * @param {string} status - 擴展狀態文字
 * @param {string} text - 主要狀態文字
 * @param {string} info - 詳細資訊文字
 * @param {string} type - 狀態類型 (loading|ready|error)
 *
 * 負責功能：
 * - 統一管理所有狀態相關的 DOM 更新
 * - 提供一致的狀態顯示介面
 *
 * 設計考量：
 * - 使用統一的狀態類型常數
 * - 確保所有狀態元素同步更新
 */
function updateStatus (status, text, info, type = STATUS_TYPES.LOADING) {
  elements.statusDot.className = `status-dot ${type}`
  elements.statusText.textContent = text
  elements.statusInfo.textContent = info
  elements.extensionStatus.textContent = status
}

/**
 * 更新按鈕狀態
 *
 * @param {boolean} disabled - 是否禁用提取按鈕
 * @param {string} [text] - 按鈕文字 (可選)
 *
 * 負責功能：
 * - 統一管理按鈕的啟用/禁用狀態
 * - 提供一致的使用者互動控制
 * - 支援動態按鈕文字更新
 */
function updateButtonState (disabled, text) {
  elements.extractBtn.disabled = disabled
  if (text) {
    elements.extractBtn.textContent = text
  }
}

/**
 * 更新版本顯示
 *
 * 負責功能：
 * - 動態獲取並顯示擴展版本號
 * - 區分開發版本和正式版本
 *
 * 設計考量：
 * - 自動從 manifest.json 獲取版本號
 * - 提供版本類型標識
 */
function updateVersionDisplay () {
  if (!elements.versionDisplay) return

  try {
    const manifest = chrome.runtime.getManifest()
    const version = manifest.version
    const isDevelopment = version.includes('dev') || version.startsWith('0.')
    const versionText = isDevelopment ? `v${version} 開發版本` : `v${version}`

    elements.versionDisplay.textContent = versionText
  } catch (error) {
    popupLogger.warn('VERSION_ERROR', { error: error.message })
    elements.versionDisplay.textContent = 'v?.?.? 未知版本'
  }
}

// ==================== 進度顯示功能 ====================

/**
 * 更新提取進度
 *
 * @param {number} percentage - 進度百分比 (0-100)
 * @param {string} text - 進度描述文字
 *
 * 負責功能：
 * - 更新進度條視覺顯示
 * - 更新進度百分比數值
 * - 更新進度描述文字
 *
 * 設計考量：
 * - 平滑的進度條動畫效果
 * - 即時的進度回饋
 */
function updateProgress (percentage, text) {
  if (!elements.progressContainer || !elements.progressBar) return

  // 顯示進度容器
  elements.progressContainer.style.display = 'block'

  // 更新進度條寬度
  const progressFill = elements.progressBar.querySelector('.progress-fill')
  if (progressFill) {
    progressFill.style.width = `${Math.min(100, Math.max(0, percentage))}%`
  }

  // 更新進度百分比
  if (elements.progressPercentage) {
    elements.progressPercentage.textContent = `${Math.round(percentage)}%`
  }

  // 更新進度文字
  if (elements.progressText && text) {
    elements.progressText.textContent = text
  }
}

/**
 * 隱藏進度顯示
 *
 * 負責功能：
 * - 隱藏進度顯示容器
 * - 重置進度狀態
 */
function hideProgress () {
  if (elements.progressContainer) {
    elements.progressContainer.style.display = 'none'
  }
}

// ==================== 結果展示功能 ====================

/**
 * 展示提取結果
 *
 * @param {Object} results - 提取結果資料
 * @param {number} results.bookCount - 提取的書籍數量
 * @param {string} results.extractionTime - 提取耗時
 * @param {number} results.successRate - 成功率
 *
 * 負責功能：
 * - 顯示提取結果統計資訊
 * - 啟用結果相關操作按鈕
 * - 提供結果查看和匯出功能
 */
function displayExtractionResults (results) {
  if (!elements.resultsContainer) return

  // 顯示結果容器
  elements.resultsContainer.style.display = 'block'

  // 更新結果資訊
  if (elements.extractedBookCount) {
    elements.extractedBookCount.textContent = results.bookCount || 0
  }

  if (elements.extractionTime) {
    elements.extractionTime.textContent = results.extractionTime || '-'
  }

  if (elements.successRate) {
    elements.successRate.textContent = results.successRate ? `${results.successRate}%` : '-'
  }

  // 啟用操作按鈕
  if (elements.exportBtn) {
    elements.exportBtn.disabled = false
  }

  if (elements.viewResultsBtn) {
    elements.viewResultsBtn.disabled = false
  }
}

/**
 * 匯出提取結果
 *
 * 負責功能：
 * - 處理結果資料匯出
 * - 支援多種匯出格式
 *
 * 使用情境：
 * - 使用者點擊匯出按鈕時呼叫
 */
function exportResults () {
  // 實現結果匯出功能 - 委派給 PopupEventController
  if (window.popupEventController) {
    window.popupEventController.handleExportClick()
  } else {
    // 備用方案：直接處理匯出
    const data = window.extractedBooks || []
    if (data.length === 0) {
      window.alert('尚無資料可匯出，請先執行書庫提取')
      return
    }

    // 簡單 JSON 匯出
    const content = JSON.stringify(data, null, 2)
    const blob = new Blob([content], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `readmoo-books-${new Date().toISOString().split('T')[0]}.json`
    a.click()
    URL.revokeObjectURL(url)

    window.alert('書庫資料已匯出為 JSON 格式')
  }
}

// ==================== 錯誤處理功能 ====================

/**
 * 顯示錯誤訊息
 *
 * @param {string} message - 錯誤訊息
 * @param {Error} [error] - 錯誤物件 (可選)
 *
 * 負責功能：
 * - 顯示詳細的錯誤訊息
 * - 提供錯誤恢復選項
 * - 記錄錯誤資訊供除錯使用
 */
function handleExtractionError (message, error) {
  if (!elements.errorContainer) return

  // 顯示錯誤容器
  elements.errorContainer.style.display = 'block'

  // 隱藏進度顯示
  hideProgress()

  // 更新錯誤訊息
  if (elements.errorMessage) {
    elements.errorMessage.textContent = message || '發生未知錯誤'
  }

  // 記錄詳細錯誤資訊
  if (error) {
    popupLogger.error('EXTRACTION_ERROR', { error })
  }

  // 重置按鈕狀態
  updateButtonState(false, '[START] 開始提取書庫資料')
}

/**
 * 重試提取操作
 *
 * 負責功能：
 * - 隱藏錯誤訊息
 * - 重新啟動提取流程
 *
 * 使用情境：
 * - 使用者點擊重試按鈕時呼叫
 */
function retryExtraction () {
  // 隱藏錯誤容器
  if (elements.errorContainer) {
    elements.errorContainer.style.display = 'none'
  }

  // 重新開始提取
  startExtraction()
}

/**
 * 向 Background Script 發送取消請求
 */
function sendCancelToBackground () {
  if (chrome && chrome.runtime) {
    chrome.runtime.sendMessage({
      type: 'CANCEL_EXTRACTION',
      timestamp: Date.now()
    }, (response) => {
      if (chrome.runtime.lastError) {
        Logger.warn('Cancel message failed', { error: chrome.runtime.lastError })
      }
    })
  }
}

/**
 * 向 Content Script 發送取消請求
 */
function sendCancelToContentScript () {
  if (chrome && chrome.tabs) {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]) {
        chrome.tabs.sendMessage(tabs[0].id, {
          type: 'CANCEL_EXTRACTION',
          timestamp: Date.now()
        }, (response) => {
          if (chrome.runtime.lastError) {
            Logger.warn('Cancel content script message failed', { error: chrome.runtime.lastError })
          }
        })
      }
    })
  }
}

/**
 * 重置提取相關的 UI 狀態
 */
function resetExtractionUI () {
  hideProgress()
  updateButtonState(false, '[START] 開始提取書庫資料')
  updateStatus('提取已取消', '使用者手動中止', '您可以重新開始提取', STATUS_TYPES.WARNING)
}

/**
 * 清理提取相關的全域狀態
 */
function cleanupExtractionState () {
  if (window.extractionInProgress) {
    window.extractionInProgress = false
  }
}

/**
 * 顯示取消後的狀態恢復通知
 */
function showCancellationRecovery () {
  setTimeout(() => {
    updateStatus('擴展就緒', '準備開始提取', '請前往 Readmoo 書庫頁面', STATUS_TYPES.READY)
  }, 3000)
}

/**
 * 處理取消提取操作
 *
 * 負責功能：
 * - 取消進行中的提取操作
 * - 重置界面狀態
 *
 * 使用情境：
 * - 使用者需要中止提取時呼叫
 */
function cancelExtraction () {
  try {
    sendCancelToBackground()
    sendCancelToContentScript()
    resetExtractionUI()
    cleanupExtractionState()
    showCancellationRecovery()
  } catch (error) {
    Logger.error('Cancel extraction failed', { error })
    updateStatus('取消失敗', '發生錯誤', '請重新整理頁面後重試', STATUS_TYPES.ERROR)
  }
}

// ==================== 通訊管理 ====================

/**
 * 建立 Background Service Worker 連線超時 Promise
 * @returns {Promise} 超時 Promise
 */
function createBackgroundTimeoutPromise () {
  return new Promise((_resolve, reject) => {
    setTimeout(() => {
      const error = (() => {
        const err = new Error('Background Service Worker 連線超時 (2秒)')
        err.code = ErrorCodes.CHROME_ERROR
        err.details = { values: ['2'], category: 'general' }
        return err
      })()
      reject(error)
    }, 2000)
  })
}

/**
 * 處理測試環境的回應
 * @param {Object} response - 回應物件
 * @returns {boolean} 是否成功
 */
function handleTestEnvironmentResponse (response) {
  Logger.info('[LOG] Test environment - processing mock response')
  updateStatus('測試模式', '測試環境', '背景服務模擬檢查完成', STATUS_TYPES.READY)
  return response && response.success !== false
}

/**
 * 處理成功的 Background Service Worker 回應
 * @param {Object} response - 成功回應物件
 */
function handleSuccessfulBackgroundResponse (response) {
  if (response.eventSystem) {
    Logger.info('事件系統狀態', { eventSystem: response.eventSystem })
  }
  updateStatus('線上', '線上 — 背景服務連線正常', '系統就緒', STATUS_TYPES.READY)
}

/**
 * 生成錯誤診斷資訊
 * @param {Error} error - 錯誤物件
 * @returns {Object} 包含 userMessage 和 diagnosticInfo 的物件
 */
function generateErrorDiagnostic (error) {
  let userMessage = '背景服務無法連線'
  let diagnosticInfo = '詳細診斷:\n'

  if (error.message.includes('超時')) {
    userMessage = '背景服務未回應'
    diagnosticInfo += '• Background Service Worker 可能已停止運行\n'
    diagnosticInfo += '• 建議重新載入擴展以重新啟動 Service Worker\n'
  } else if (error.message.includes('Extension context invalidated')) {
    userMessage = '擴展上下文已失效'
    diagnosticInfo += '• 擴展上下文已失效\n'
    diagnosticInfo += '• 請重新載入擴展頁面\n'
  } else if (error.message.includes('receiving end does not exist')) {
    userMessage = '背景服務未啟動'
    diagnosticInfo += '• Background Script 未載入或已停止\n'
    diagnosticInfo += '• 檢查擴展是否正確安裝和啟用\n'
  } else {
    userMessage = '通訊發生錯誤'
    diagnosticInfo += '• 未知的通訊錯誤\n'
    diagnosticInfo += '• 請嘗試重新載入擴展\n'
  }

  diagnosticInfo += '\n操作建議: 點擊瀏覽器右上角擴展圖示，選擇「重新載入」'
  diagnosticInfo += '\n錯誤詳情: ' + error.message

  return { userMessage, diagnosticInfo }
}

/**
 * 單次嘗試 GET_STATUS（settled flag + late-response 修正）
 *
 * timeout 走 macrotask（jest.advanceTimersByTime 同步觸發）。
 * sendMessage resolve 走 microtask（.then）。
 *
 * 在 advanceTimersByTime 推進期間 macrotask 先於 microtask 觸發，
 * 所以 timeout 可能搶先。但 .then handler 無論 settled 狀態皆呼叫
 * onResponse，讓 late-arriving response 能在 microtask drain 時
 * 修正 timeout 發起的重試（取消重試 timer + resolve）。
 *
 * @param {Function} onResponse - (response) => void，sendMessage 成功時呼叫
 * @param {Function} onTimeout - () => void，timeout 或 sendMessage reject 時呼叫
 */
function attemptGetStatus (onResponse, onTimeout) {
  let settled = false

  const timerId = setTimeout(() => {
    if (!settled) {
      settled = true
      onTimeout()
    }
  }, HANDSHAKE_CONFIG.TIMEOUT_MS)

  chrome.runtime.sendMessage({ type: MESSAGE_TYPES.GET_STATUS }).then((response) => {
    if (!settled) {
      settled = true
      clearTimeout(timerId)
    }
    onResponse(response)
  }).catch(() => {
    if (!settled) {
      settled = true
      clearTimeout(timerId)
      onTimeout()
    }
  })
}

/**
 * 處理握手回應：就緒回 true、初始化中回 null（需重試）、失敗回 null
 * @param {Object|null} response
 * @returns {boolean|null}
 */
function handleHandshakeResponse (response) {
  if (response && response.success && !response.initializing) {
    handleSuccessfulBackgroundResponse(response)
    return true
  }
  if (response && response.success && response.initializing) {
    updateStatus('初始化中', '初始化中 — 背景服務正在啟動', '系統初始化中，請稍候', STATUS_TYPES.LOADING)
  }
  return null
}

/**
 * 檢查 Background Service Worker 狀態（含重試機制）
 *
 * @returns {Promise<boolean>} 是否正常運作
 *
 * 1.1.0-W1-019 A+C 方案。attemptGetStatus 的 timeout 走 macrotask，
 * sendMessage resolve 走 microtask。advanceTimersByTime 推進時 timeout
 * 可能搶先（macrotask 間不 drain 原生 Promise microtask），late-response
 * 修正機制讓 .then 結果在後續 microtask drain 時取消已排重試並 resolve。
 */
function checkBackgroundStatus () {
  isFinalStatus = true
  return new Promise((resolve) => {
    let done = false
    let retryTimerId = null

    function finish (value) {
      if (done) return
      done = true
      if (retryTimerId) { clearTimeout(retryTimerId); retryTimerId = null }
      if (value) { isFinalStatus = false }
      resolve(value)
    }

    function handleAttempt (attempt, delay) {
      attemptGetStatus(
        function onResponse (response) {
          if (done) return
          if (retryTimerId) { clearTimeout(retryTimerId); retryTimerId = null }
          const result = handleHandshakeResponse(response)
          if (result === true) { finish(true); return }
          scheduleRetry(attempt, delay)
        },
        function onTimeout () {
          if (done) return
          scheduleRetry(attempt, delay)
        }
      )
    }

    function scheduleRetry (attempt, delay) {
      if (done) return
      if (attempt >= HANDSHAKE_CONFIG.MAX_RETRY_ATTEMPTS) {
        Logger.error('Background Service Worker 連線失敗', { retryCount: attempt })
        updateStatus('離線', '離線 — 背景服務無法連線', '重試已用盡，請重新載入擴展', STATUS_TYPES.ERROR)
        finish(false)
        return
      }
      updateStatus('初始化中', '初始化中 — 背景服務正在啟動', '系統初始化中，請稍候', STATUS_TYPES.LOADING)
      retryTimerId = setTimeout(() => {
        retryTimerId = null
        handleAttempt(attempt + 1, delay * HANDSHAKE_CONFIG.RETRY_BACKOFF_MULTIPLIER)
      }, delay)
    }

    handleAttempt(0, HANDSHAKE_CONFIG.INITIAL_RETRY_DELAY_MS)
  })
}

/**
 * 檢查當前標籤頁狀態
 *
 * @returns {Promise<chrome.tabs.Tab|null>} 當前標籤頁物件或 null
 *
 * 負責功能：
 * - 檢查當前標籤頁是否為 Readmoo 頁面
 * - 測試與 Content Script 的通訊狀態
 * - 更新頁面資訊和按鈕狀態
 *
 * 設計考量：
 * - 支援不同的 Readmoo 頁面路徑
 * - 適當處理 Content Script 尚未載入的情況
 * - 提供清楚的頁面狀態指示
 *
 * 處理流程：
 * 1. 查詢當前活動標籤頁
 * 2. 檢查是否為 Readmoo 域名
 * 3. 嘗試與 Content Script 通訊
 * 4. 根據結果更新 UI 狀態和按鈕
 */
async function checkCurrentTab () {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })

    if (!tab) {
      updateStatus('無效', '無法取得標籤頁資訊', '請重新整理頁面後再試', STATUS_TYPES.ERROR)
      return null
    }

    // 檢查是否為 Readmoo 頁面
    const isReadmoo = tab.url && tab.url.includes(CONFIG.READMOO_DOMAIN)

    elements.pageInfo.textContent = isReadmoo
      ? `Readmoo (${new URL(tab.url).pathname}${new URL(tab.url).hash})`
      : '非 Readmoo 頁面'

    if (isReadmoo) {
      // 嘗試與 Content Script 通訊
      try {
        const response = await chrome.tabs.sendMessage(tab.id, { type: MESSAGE_TYPES.PING })

        if (response && response.success) {
          if (response.bookCount !== undefined) {
            elements.bookCount.textContent = String(response.bookCount)
          } else {
            elements.bookCount.textContent = '0'
          }
          updateStatus('就緒', 'Content Script 連線正常', '可以開始提取書庫資料', STATUS_TYPES.READY)
          updateButtonState(false)
          return tab
        }
      } catch (error) {
        Logger.info('Content Script 尚未就緒', { error })
        updateStatus('載入中', MESSAGES.CONTENT_SCRIPT_LOADING, MESSAGES.CONTENT_SCRIPT_RELOAD_HINT, STATUS_TYPES.LOADING)
      }
    } else {
      updateStatus('待機', MESSAGES.NON_READMOO_PAGE, MESSAGES.NON_READMOO_HINT, STATUS_TYPES.READY)
      updateButtonState(true)
    }

    return tab
  } catch (error) {
    Logger.error('檢查標籤頁時發生錯誤', { error })
    updateStatus('錯誤', '無法檢查頁面狀態', error.message, STATUS_TYPES.ERROR)
    return null
  }
}

// ==================== 操作處理 ====================

/**
 * 設定提取完成監聽器
 *
 * 業務情境：
 * - W1-001.2 實機驗證發現 928 本提取成功後 popup 仍顯示「檢測中...」
 * - UC-01 step 6 規格要求「Popup 顯示提取結果：成功提取 X 本書籍」
 * - 根因：popup 對 START_EXTRACTION 的同步回應只代表「流程已啟動」，
 *   真實提取結果由 background 異步寫入 chrome.storage.local.readmoo_books，
 *   popup 缺乏對該 storage key 變更的監聽，導致提取完成事件無正向回饋
 *
 * 處理流程：
 * 1. 在 startExtraction 觸發成功後呼叫
 * 2. 註冊一次性 chrome.storage.onChanged 監聽器
 * 3. 偵測 readmoo_books 變更時，依新值 books 陣列長度更新 UI
 * 4. 完成更新後自動移除監聽器，避免後續干擾或記憶體累積
 *
 * 設計考量：
 * - 監聽器一次性：popup 生命週期短，本次提取結果顯示完即可解除
 * - storage area 限定 local：與 background 寫入位置（chrome.storage.local）一致
 * - newValue 缺失或非陣列時不誤更新，保留既有狀態避免錯誤回饋
 *
 * @returns {void}
 */
function setupExtractionCompletionListener () {
  if (typeof chrome === 'undefined' || !chrome.storage || !chrome.storage.onChanged) {
    return
  }

  const listener = (changes, areaName) => {
    if (areaName !== 'local') return
    if (!changes || !changes.readmoo_books) return

    const newValue = changes.readmoo_books.newValue
    if (!newValue || !Array.isArray(newValue.books)) return

    const bookCount = newValue.books.length
    updateStatus('完成', '提取成功', `提取成功 ${bookCount} 本書籍`, STATUS_TYPES.READY)
    if (elements.bookCount) {
      elements.bookCount.textContent = String(bookCount)
    }
    // W1-062.1：設定終態旗標，阻止 periodicStatusUpdate 覆寫終態 status
    isFinalStatus = true

    try {
      chrome.storage.onChanged.removeListener(listener)
    } catch (error) {
      Logger.warn('移除 storage onChanged 監聽器失敗', { error: error.message })
    }
  }

  chrome.storage.onChanged.addListener(listener)
}

/**
 * 開始資料提取
 *
 * @returns {Promise<void>}
 *
 * 負責功能：
 * - 驗證頁面狀態並啟動資料提取流程
 * - 處理提取過程中的狀態更新
 * - 管理按鈕狀態和使用者回饋
 *
 * 設計考量：
 * - 確保在正確的頁面環境下執行
 * - 提供清楚的進度指示和結果回饋
 * - 適當的錯誤處理和恢復機制
 *
 * 處理流程：
 * 1. 檢查當前標籤頁狀態
 * 2. 禁用按鈕並顯示進度狀態
 * 3. 註冊 storage 變更監聽器（捕捉真實提取完成）
 * 4. 發送提取開始訊息到 Content Script
 * 5. 處理 START_EXTRACTION 同步回應（流程啟動確認）
 * 6. 由 storage onChanged 監聽器負責最終「提取成功 N 本書籍」回饋
 * 7. 恢復按鈕狀態
 */
async function startExtraction () {
  // W1-062.1：用戶再次點擊「開始提取」時重置終態旗標，回到 polling 模式。
  // 此重置必須在所有可能的 updateStatus 呼叫之前，確保 periodicStatusUpdate
  // 在新一輪提取流程中能正常更新檢測狀態（如「就緒」「載入中」「待機」）。
  isFinalStatus = false

  const tab = await checkCurrentTab()
  if (!tab) return

  try {
    updateStatus('提取中', MESSAGES.EXTRACTION_IN_PROGRESS, MESSAGES.EXTRACTION_HINT, STATUS_TYPES.LOADING)
    updateButtonState(true)

    // 提取結果由 background 異步寫入 chrome.storage.local.readmoo_books，
    // 先註冊監聽器以免錯過 storage 變更事件
    setupExtractionCompletionListener()

    const response = await chrome.tabs.sendMessage(tab.id, { type: MESSAGE_TYPES.START_EXTRACTION })

    if (response && response.success) {
      updateStatus('完成', '資料提取完成', response.message, STATUS_TYPES.READY)

      if (response.booksDetected !== undefined) {
        elements.bookCount.textContent = response.booksDetected
      }
      // W1-062.1：同步 response 終態，雖然真實 N 本書籍由 storage onChanged 監聽器
      // 後續覆蓋，但「資料提取完成」屬流程啟動成功訊息，也應 sticky 避免 polling 覆寫。
      isFinalStatus = true
    } else {
      const error = (() => {
        const err = new Error(response?.error || '未知錯誤')
        err.code = ErrorCodes.OPERATION_ERROR
        err.details = { category: 'general', response }
        return err
      })()
      throw error
    }
  } catch (error) {
    Logger.error('提取過程發生錯誤', { error })
    updateStatus('失敗', '提取失敗', error.message, STATUS_TYPES.ERROR)
    // W1-062.1：提取失敗為終態，保持失敗訊息直到用戶再次點擊提取
    isFinalStatus = true
  } finally {
    updateButtonState(false)
  }
}

/**
 * 顯示設定介面
 *
 * 負責功能：
 * - 處理設定按鈕點擊事件
 * - 顯示設定相關訊息
 *
 * 設計考量：
 * - 預留未來設定功能的擴展空間
 * - 提供使用者適當的功能說明
 */
function showSettings () {
  window.alert(MESSAGES.SETTINGS_PLACEHOLDER)
}

/**
 * 顯示使用說明
 *
 * 負責功能：
 * - 處理說明按鈕點擊事件
 * - 提供詳細的使用指導
 *
 * 設計考量：
 * - 提供清楚的操作步驟說明
 * - 預留未來詳細說明頁面的擴展空間
 */
function showHelp () {
  window.alert(MESSAGES.HELP_TEXT)
}

/**
 * 開啟書庫總覽頁面
 *
 * 負責功能：
 * - 使用 Chrome Extension API 開啟 overview 頁面
 * - 提供錯誤處理和使用者回饋
 * - 支援無障礙功能
 *
 * 設計考量：
 * - 使用標準的 chrome.runtime.openOptionsPage() API
 * - 適當的錯誤處理避免使用者困惑
 * - 保持一致的使用者體驗
 *
 * 使用情境：
 * - 使用者點擊「檢視書庫」按鈕時
 * - 提取完成後點擊「查看結果」時
 */
function openLibraryOverview () {
  try {
    Logger.info('開啟書庫總覽頁面...')
    chrome.runtime.openOptionsPage()
  } catch (error) {
    Logger.error('無法開啟書庫頁面', { error })
    window.alert('無法開啟書庫頁面，請稍後再試')
  }
}

// ==================== 事件管理 ====================

/**
 * 設定事件監聽器
 *
 * 負責功能：
 * - 為所有互動元素設定適當的事件監聽器
 * - 確保使用者互動能正確觸發對應功能
 *
 * 設計考量：
 * - 統一的事件處理機制
 * - 清晰的職責分離
 */
function setupEventListeners () {
  // 主要操作按鈕
  elements.extractBtn.addEventListener('click', startExtraction)
  elements.settingsBtn.addEventListener('click', showSettings)
  elements.helpBtn.addEventListener('click', showHelp)
  elements.viewLibraryBtn.addEventListener('click', openLibraryOverview)

  // 結果操作按鈕
  if (elements.exportBtn) {
    elements.exportBtn.addEventListener('click', exportResults)
  }

  if (elements.viewResultsBtn) {
    elements.viewResultsBtn.addEventListener('click', openLibraryOverview)
  }

  // 錯誤處理按鈕
  if (elements.retryBtn) {
    elements.retryBtn.addEventListener('click', retryExtraction)
  }

  if (elements.reportBtn) {
    elements.reportBtn.addEventListener('click', () => {
      window.alert('問題回報功能將在後續版本實現')
    })
  }

  // 初始化報告按鈕
  if (elements.initReportBtn) {
    elements.initReportBtn.addEventListener('click', showInitializationReport)
  }

  // 匯入面板
  if (ImportPanel && elements.importBtn && elements.importFileInput) {
    const importElements = buildImportPanelElements()
    const importPanel = new ImportPanel({
      importBtn: elements.importBtn,
      fileInput: elements.importFileInput,
      ...importElements
    })
    importPanel.initialize()
  }
}

/**
 * 以 ui-factory 建立匯入結果 / 匯入錯誤兩張卡片並掛載到 importPanelMount，
 * 回傳 ImportPanel 需要的子元素引用（ticket 1.2.0-W2-003.2）。
 *
 * 匯入結果與匯入錯誤共用 createCard（AC-1）；關閉按鈕由 createButton 動態
 * 產生（AC-2）。ImportPanel 直接寫入這些工廠產生的元素 textContent / display，
 * 取代原本 popup.html 硬編碼 + getElementById 的取得方式（AC-5）。
 *
 * @returns {Object} { resultContainer, resultTitle, resultSummary, closeResultBtn,
 *                      errorContainer, errorTitle, errorMessage, closeErrorBtn }
 */
function buildImportPanelElements () {
  const { createCard, createButton } = uiFactory

  // 卡片完全由 ui-factory 在其自身 realm 建立（title / content / actions 皆走工廠
  // 參數），避免跨 realm appendChild（eval 環境下 popup.js 與工廠 document 可能不同）。
  // 子元素引用一律以 querySelector 從工廠產物取回，交由 ImportPanel 寫入。
  const closeResultBtn = createButton({ variant: 'secondary', size: 'small' })
  const resultContainer = createCard({
    variant: 'default',
    id: 'importResultContainer',
    title: '',
    content: '',
    actions: [closeResultBtn]
  })
  resultContainer.style.display = 'none'
  const resultTitle = resultContainer.querySelector('.results-header strong')
  const resultSummary = resultContainer.querySelector('.info-text')

  const closeErrorBtn = createButton({ variant: 'secondary', size: 'small' })
  const errorContainer = createCard({
    variant: 'error',
    id: 'importErrorContainer',
    title: '',
    content: '',
    actions: [closeErrorBtn]
  })
  errorContainer.style.display = 'none'
  const errorTitle = errorContainer.querySelector('.error-header strong')
  // createCard 對 error variant 的字串 content 仍包進 info-text；ImportPanel 寫入
  // 此元素的 textContent 作為錯誤訊息文字。
  const errorMessage = errorContainer.querySelector('.info-text')

  const mount = document.getElementById('importPanelMount')
  if (mount) {
    try {
      mount.appendChild(resultContainer)
      mount.appendChild(errorContainer)
    } catch (error) {
      // 生產 bundle 為單一 realm，appendChild 永遠成功。此 catch 僅在 eval 型測試
      // harness 觸發：popup.js 在 eval realm、ui-factory 經 require 載入於另一 jsdom
      // realm，跨 realm node 無法 append（jsdom 不識別、adoptNode 亦拒）。記 warn
      // 供觀測（observability 規則 4），不阻斷其餘初始化。
      popupLogger.warn('IMPORT_PANEL_MOUNT_FAILED', {
        component: 'PopupInterface',
        error: error && error.message
      })
    }
  }

  return {
    resultContainer,
    resultTitle,
    resultSummary,
    closeResultBtn,
    errorContainer,
    errorTitle,
    errorMessage,
    closeErrorBtn
  }
}

/**
 * 建立書庫導航選單並掛載到 bookstoreNavMount（1.4.2-W1-001）。
 */
function mountBookstoreNav () {
  const mount = document.getElementById('bookstoreNavMount')
  if (!mount || !uiFactory || !uiFactory.createBookstoreNavSection) return
  if (!BOOKSTORE_LIST || BOOKSTORE_LIST.length === 0) return

  const { NAVIGATION_TEXT } = popupConstants

  const section = uiFactory.createBookstoreNavSection({
    bookstores: BOOKSTORE_LIST,
    sectionTitle: NAVIGATION_TEXT.SECTION_TITLE,
    ariaPrefix: NAVIGATION_TEXT.GO_BUTTON_ARIA_PREFIX,
    onNavigate: (store) => {
      chrome.tabs.create({ url: store.url })
    }
  })

  mount.appendChild(section)
}

// ==================== 初始化和生命週期管理 ====================

/**
 * 初始化函數
 *
 * @returns {Promise<void>}
 *
 * 負責功能：
 * - 執行完整的 Popup 界面初始化流程
 * - 協調各個初始化步驟的執行順序
 *
 * 設計考量：
 * - 按照依賴關係安排初始化順序
 * - 提供完整的錯誤處理
 * - 確保界面在初始化失敗時仍可使用
 *
 * 處理流程：
 * 1. 設定事件監聽器
 * 2. 檢查 Background Service Worker 狀態
 * 3. 檢查當前標籤頁狀態
 * 4. 完成初始化
 */
async function initialize () {
  popupLogger.info('POPUP_INIT_START')

  // 初始化進度追蹤器
  if (typeof PopupInitializationTracker !== 'undefined') {
    initializationTracker = new PopupInitializationTracker()
    initializationTracker.startTracking()
  }

  try {
    // 步驟1: DOM 就緒確認
    if (initializationTracker) {
      initializationTracker.startStep('dom_ready')
    }
    await new Promise(resolve => setTimeout(resolve, 100)) // 確保DOM完全就緒
    if (initializationTracker) {
      initializationTracker.completeStep('dom_ready', 'DOM 元素已就緒')
    }

    // 以集中常數覆寫 HTML 靜態 UI 文字，使 constants/ui-text.js 成為運行時來源
    applyStaticUIText()

    // 書庫導航選單掛載（1.4.2-W1-001）
    mountBookstoreNav()

    // 步驟2: 更新版本顯示
    if (initializationTracker) {
      initializationTracker.startStep('version_display')
    }
    updateVersionDisplay()
    if (initializationTracker) {
      initializationTracker.completeStep('version_display', '版本資訊已顯示')
    }

    // 步驟3: 初始化錯誤處理器
    if (initializationTracker) {
      initializationTracker.startStep('error_handler')
    }
    initializeErrorHandler()
    if (initializationTracker) {
      initializationTracker.completeStep('error_handler', '錯誤處理器已初始化')
    }

    // 步驟4: 初始化診斷增強器
    if (initializationTracker) {
      initializationTracker.startStep('diagnostic_enhancer')
    }
    await initializeDiagnosticEnhancer()
    if (initializationTracker) {
      initializationTracker.completeStep('diagnostic_enhancer', '診斷增強器已初始化')
    }

    // 步驟5: 設定事件監聽器
    if (initializationTracker) {
      initializationTracker.startStep('event_listeners')
    }
    setupEventListeners()
    if (initializationTracker) {
      initializationTracker.completeStep('event_listeners', '事件監聽器已設定')
    }

    // 步驟6: 檢查 Background Service Worker
    if (initializationTracker) {
      initializationTracker.startStep('background_check')
    }
    const backgroundOk = await checkBackgroundStatus()
    if (!backgroundOk) {
      if (initializationTracker) {
        const error = new Error('Background Service Worker 連線失敗')
        error.code = ErrorCodes.CHROME_ERROR
        error.details = { category: 'general' }
        initializationTracker.failStep('background_check', error)
      }

      // 觸發系統初始化錯誤
      if (errorHandler) {
        errorHandler.handleInitializationError({
          type: 'BACKGROUND_SERVICE_WORKER_FAILED',
          message: 'Background Service Worker 無法連線'
        })
      }
      return
    } else {
      if (initializationTracker) {
        initializationTracker.completeStep('background_check', 'Background Service Worker 連線成功')
      }
    }

    // 步驟7: 檢查當前標籤頁
    if (initializationTracker) {
      initializationTracker.startStep('current_tab')
    }
    await checkCurrentTab()
    if (initializationTracker) {
      initializationTracker.completeStep('current_tab', '標籤頁狀態檢查完成')
    }

    // 步驟8: 完成初始化
    if (initializationTracker) {
      initializationTracker.startStep('finalization')
    }
    popupLogger.info('POPUP_INIT_COMPLETE')
    if (initializationTracker) {
      initializationTracker.completeStep('finalization', '初始化流程完成')
    }
  } catch (error) {
    popupLogger.error('POPUP_INIT_ERROR', { error })

    // 記錄失敗的步驟
    if (initializationTracker && !initializationTracker.isFailed) {
      const currentStep = initializationTracker.steps.find(s => s.status === 'running')
      if (currentStep) {
        initializationTracker.failStep(currentStep.id, error)
      }
    }

    // 使用增強的錯誤處理
    if (errorHandler) {
      errorHandler.handleInitializationError({
        type: 'POPUP_INITIALIZATION_ERROR',
        message: error.message,
        stack: error.stack,
        initializationReport: initializationTracker ? initializationTracker.getInitializationReport() : null
      })
    } else {
      // 備用錯誤處理
      updateStatus('錯誤', '初始化失敗', error.message, STATUS_TYPES.ERROR)
    }

    // 顯示初始化報告按鈕
    if (elements.initReportBtn && initializationTracker) {
      elements.initReportBtn.style.display = 'inline-block'
    }
  }
}

/**
 * 定期狀態更新函數
 *
 * 業務情境：
 * - W1-062 修復 storage onChanged 後 popup 顯示「提取成功 N 本書籍」終態
 * - W1-062.1 發現本函式每 3 秒透過 checkCurrentTab() 將 status 覆寫回「就緒」，
 *   使終態僅顯示不到 3 秒
 *
 * 負責功能：
 * - 非終態（polling 模式）：定期呼叫 checkCurrentTab() 更新 UI 狀態
 * - 終態（isFinalStatus=true）：跳過 status 更新，但仍執行 chrome.tabs.query
 *   作為健康探測（確保 tabs API 可用、interval 仍持續運作）
 *
 * 設計考量：
 * - 節省資源，僅在頁面可見時執行
 * - 終態旗標 sticky 直到用戶再次點擊「開始提取」（startExtraction 重置）
 * - 健康探測失敗時記錄 warning 但不更新 UI，避免覆寫終態訊息
 */
async function periodicStatusUpdate () {
  if (document.visibilityState !== 'visible') {
    return
  }

  if (isFinalStatus) {
    // W1-062.1：終態模式 — 跳過 checkCurrentTab（含 updateStatus）避免覆寫終態，
    // 但仍呼叫 chrome.tabs.query 作為輕量健康探測（驗證 tabs API 可用、interval 運作）
    try {
      await chrome.tabs.query({ active: true, currentWindow: true })
    } catch (error) {
      Logger.warn('periodicStatusUpdate 健康探測失敗（終態模式）', { error: error.message })
    }
    return
  }

  await checkCurrentTab()
}

// ==================== 錯誤處理 ====================

/**
 * 全域錯誤處理器
 *
 * @param {ErrorEvent} event - 錯誤事件
 *
 * 負責功能：
 * - 捕獲並處理未預期的錯誤
 * - 提供統一的錯誤回饋機制
 *
 * 設計考量：
 * - 防止錯誤導致界面完全失效
 * - 提供有用的錯誤資訊給使用者
 */
/**
 * 初始化錯誤處理系統
 */

function initializeErrorHandler () {
  if (typeof PopupErrorHandler !== 'undefined') {
    errorHandler = new PopupErrorHandler()
    errorHandler.initialize()
  }
}

async function initializeDiagnosticEnhancer () {
  if (typeof PopupDiagnosticEnhancer !== 'undefined') {
    diagnosticEnhancer = new PopupDiagnosticEnhancer()
    const result = await diagnosticEnhancer.initialize()

    if (!result.success) {
      Logger.warn('診斷增強器初始化失敗', { error: result.error })
    } else {
      // 設置系統健康檢查按鈕事件監聽器
      const healthCheckBtn = document.getElementById('systemHealthCheckBtn')
      if (healthCheckBtn) {
        healthCheckBtn.addEventListener('click', async () => {
          healthCheckBtn.disabled = true
          healthCheckBtn.textContent = '[WAIT] 檢查中...'

          try {
            const healthReport = await diagnosticEnhancer.performSystemHealthCheck()
            displayHealthCheckResults(healthReport)
          } catch (error) {
            Logger.error('健康檢查錯誤', { error })
            alert('健康檢查失敗: ' + error.message)
          } finally {
            healthCheckBtn.disabled = false
            healthCheckBtn.textContent = '系統健康檢查'
          }
        })
      }
    }
  }
}

function displayHealthCheckResults (healthReport) {
  const { summary, checks, recommendations } = healthReport

  let statusText = '系統健康檢查結果：\n'
  statusText += `[OK] 通過: ${summary.passed} 項\n`
  statusText += `[WARN] 警告: ${summary.warnings} 項\n`
  statusText += `[FAIL] 失敗: ${summary.failed} 項\n\n`

  // 顯示主要問題
  const failedChecks = Object.values(checks).filter(check => check.status === 'failed')
  if (failedChecks.length > 0) {
    statusText += '主要問題：\n'
    failedChecks.forEach(check => {
      statusText += `• ${check.name}: ${check.details.join(', ')}\n`
    })
    statusText += '\n'
  }

  // 顯示建議
  if (recommendations.length > 0) {
    statusText += '建議解決方案：\n'
    recommendations.slice(0, 3).forEach((rec, index) => {
      statusText += `${index + 1}. ${rec.action}\n`
    })
  }

  // 在錯誤容器中顯示結果
  const errorContainer = elements.errorContainer
  const errorMessage = elements.errorMessage

  if (errorContainer && errorMessage) {
    errorMessage.textContent = statusText
    errorContainer.style.display = 'block'

    // 更改樣式以表示這是診斷資訊，不是錯誤
    // Design System 配色：成功=successLight/success，警告=warningLight/warning
    errorContainer.style.backgroundColor = summary.failed === 0
      ? (COLORS ? COLORS.successLight : '#C8E6C9')
      : (COLORS ? COLORS.warningLight : '#FFE0B2')
    errorContainer.style.borderColor = summary.failed === 0
      ? (COLORS ? COLORS.success : '#4CAF50')
      : (COLORS ? COLORS.warning : '#FF9800')
  } else {
    alert(statusText)
  }
}

/**
 * 顯示初始化報告
 */
function showInitializationReport () {
  if (!initializationTracker) {
    alert('初始化追蹤器未載入')
    return
  }

  const report = initializationTracker.getInitializationReport()

  let reportText = '[CHECK] Popup 初始化詳細報告\n\n'

  // 基本統計
  reportText += '[STATS] 總體統計：\n'
  reportText += `• 總步驟數: ${report.summary.totalSteps}\n`
  reportText += `• 完成步驟: ${report.summary.completedSteps}\n`
  reportText += `• 失敗步驟: ${report.summary.failedSteps}\n`
  reportText += `• 執行中步驟: ${report.summary.runningSteps}\n`

  if (report.totalDuration) {
    reportText += `• 總耗時: ${report.totalDuration}ms\n`
  }

  reportText += '\n[TIME] 詳細步驟執行記錄：\n'

  // 步驟詳情
  report.steps.forEach((step, index) => {
    const statusIcon = step.status === 'completed'
      ? '[OK]'
      : step.status === 'failed'
        ? '[FAIL]'
        : step.status === 'running' ? '[RUNNING]' : '[PAUSE]'

    reportText += `${index + 1}. ${statusIcon} ${step.name}\n`
    reportText += `   描述: ${step.description}\n`

    if (step.duration) {
      reportText += `   耗時: ${step.duration}ms\n`
    }

    if (step.error) {
      reportText += `   錯誤: ${step.error}\n`
    }

    reportText += '\n'
  })

  // 如果有失敗，提供建議
  if (report.summary.failedSteps > 0) {
    reportText += '故障排除建議：\n'
    reportText += '1. 重新載入擴展 (chrome://extensions/)\n'
    reportText += '2. 重新整理頁面並重新開啟 Popup\n'
    reportText += '3. 重啟 Chrome 瀏覽器\n'
    reportText += '4. 執行系統健康檢查以獲得更多診斷資訊\n'
  }

  // 在錯誤容器中顯示報告
  const errorContainer = elements.errorContainer
  const errorMessage = elements.errorMessage

  if (errorContainer && errorMessage) {
    errorMessage.style.whiteSpace = 'pre-line'
    errorMessage.textContent = reportText
    errorContainer.style.display = 'block'

    // Design System 配色：資訊性內容使用 primaryLightest/primary
    errorContainer.style.backgroundColor = COLORS ? COLORS.primaryLightest : '#E3F2FD'
    errorContainer.style.borderColor = COLORS ? COLORS.primary : '#2196F3'
  } else {
    alert(reportText)
  }
}

function handleGlobalError (event) {
  Logger.error('Popup Interface 錯誤', { error: event.error })

  // 如果錯誤處理器可用，使用增強的錯誤處理
  if (errorHandler) {
    errorHandler.showUserFriendlyError({
      type: 'POPUP_INTERFACE_ERROR',
      data: {
        message: event.error.message,
        stack: event.error.stack
      }
    })
  } else {
    // 備用的基本錯誤處理
    updateStatus('錯誤', '界面發生錯誤', event.error.message, STATUS_TYPES.ERROR)
  }
}

// ==================== 全域範圍暴露 (供測試使用) ====================

// 將關鍵物件和函數暴露到全域範圍供測試使用
if (typeof window !== 'undefined') {
  window.elements = elements
  window.updateStatus = updateStatus
  window.updateButtonState = updateButtonState
  window.updateVersionDisplay = updateVersionDisplay
  window.checkCurrentTab = checkCurrentTab
  window.checkBackgroundStatus = checkBackgroundStatus
  window.startExtraction = startExtraction
  window.setupExtractionCompletionListener = setupExtractionCompletionListener
  window.setupEventListeners = setupEventListeners
  window.initialize = initialize
  // W1-062.1：暴露 periodicStatusUpdate 與 isFinalStatus 旗標讀寫供測試使用
  window.periodicStatusUpdate = periodicStatusUpdate
  window.getIsFinalStatus = () => isFinalStatus
  window.setIsFinalStatus = (value) => { isFinalStatus = !!value }

  // 新增的進度和結果功能
  window.updateProgress = updateProgress
  window.hideProgress = hideProgress
  window.displayExtractionResults = displayExtractionResults
  window.exportResults = exportResults
  window.handleExtractionError = handleExtractionError
  window.retryExtraction = retryExtraction
  window.cancelExtraction = cancelExtraction

  // 重構後的拆分函式
  window.sendCancelToBackground = sendCancelToBackground
  window.sendCancelToContentScript = sendCancelToContentScript
  window.resetExtractionUI = resetExtractionUI
  window.cleanupExtractionState = cleanupExtractionState
  window.showCancellationRecovery = showCancellationRecovery
  window.createBackgroundTimeoutPromise = createBackgroundTimeoutPromise
  window.handleTestEnvironmentResponse = handleTestEnvironmentResponse
  window.handleSuccessfulBackgroundResponse = handleSuccessfulBackgroundResponse
  window.generateErrorDiagnostic = generateErrorDiagnostic

  // 書庫導航
  window.mountBookstoreNav = mountBookstoreNav

  // 暴露常數供測試驗證
  window.STATUS_TYPES = STATUS_TYPES
  window.MESSAGE_TYPES = MESSAGE_TYPES
  window.MESSAGES = MESSAGES
  window.CONFIG = CONFIG
  window.HANDSHAKE_CONFIG = HANDSHAKE_CONFIG
}

// ==================== 啟動流程 ====================

// 頁面載入完成後初始化
document.addEventListener('DOMContentLoaded', initialize)

// 定期更新狀態
setInterval(periodicStatusUpdate, CONFIG.STATUS_UPDATE_INTERVAL)

// 全域錯誤處理
window.addEventListener('error', handleGlobalError)

popupLogger.info('POPUP_SCRIPT_LOADED')
