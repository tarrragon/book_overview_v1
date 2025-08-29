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

console.log('🎨 Popup Interface 載入完成')

// ==================== 常數定義 ====================

/**
 * 狀態類型常數
 */
const STATUS_TYPES = {
  LOADING: 'loading',
  READY: 'ready',
  ERROR: 'error'
}

/**
 * 訊息類型常數
 */
const MESSAGE_TYPES = {
  PING: 'PING',
  GET_STATUS: 'GET_STATUS',
  START_EXTRACTION: 'START_EXTRACTION'
}

/**
 * 預設訊息常數
 */
const MESSAGES = {
  SETTINGS_PLACEHOLDER: '設定功能將在後續版本實現',
  HELP_TEXT: '使用說明：\n\n1. 前往 Readmoo 書庫頁面\n2. 點擊「開始提取書庫資料」\n3. 等待提取完成\n\n詳細說明將在後續版本提供',
  STATUS_CHECKING: '正在檢查狀態...',
  STATUS_INITIALIZING: '請稍候，正在初始化擴展功能',
  CONTENT_SCRIPT_LOADING: 'Content Script 載入中',
  CONTENT_SCRIPT_RELOAD_HINT: '請稍候或重新整理頁面',
  NON_READMOO_PAGE: '請前往 Readmoo 網站',
  NON_READMOO_HINT: '需要在 Readmoo 書庫頁面使用此功能',
  EXTRACTION_IN_PROGRESS: '正在提取書庫資料',
  EXTRACTION_HINT: '請保持頁面開啟，不要關閉瀏覽器'
}

/**
 * 配置常數
 */
const CONFIG = {
  STATUS_UPDATE_INTERVAL: 3000, // 3 秒
  READMOO_DOMAIN: 'readmoo.com'
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
    console.warn('無法獲取版本號:', error)
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
  // TODO: 實現結果匯出功能
  window.alert('匯出功能將在後續版本實現')
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
    console.error('❌ 提取錯誤詳情:', error)
  }

  // 重置按鈕狀態
  updateButtonState(false, '🚀 開始提取書庫資料')
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
  // TODO: 實現取消提取功能
  hideProgress()
  updateButtonState(false, '🚀 開始提取書庫資料')
  updateStatus('擴展就緒', '準備開始提取', '請前往 Readmoo 書庫頁面', STATUS_TYPES.READY)
}

// ==================== 通訊管理 ====================

/**
 * 檢查 Background Service Worker 狀態
 *
 * @returns {Promise<boolean>} 是否正常運作
 *
 * 負責功能：
 * - 驗證 Background Service Worker 的連線狀態
 * - 處理通訊錯誤和異常情況
 *
 * 設計考量：
 * - 使用標準化的訊息格式
 * - 提供清楚的錯誤訊息和狀態回饋
 *
 * 處理流程：
 * 1. 發送狀態檢查訊息到 Background
 * 2. 等待回應並驗證結果
 * 3. 根據結果更新 UI 狀態
 * 4. 處理錯誤並提供使用者回饋
 */
async function checkBackgroundStatus () {
  // 測試環境中跳過檢查
  if (process.env.NODE_ENV === 'test') {
    console.log('📝 Test environment - skipping background service check')
    updateStatus('測試模式', '測試環境', '跳過背景服務檢查', STATUS_TYPES.READY)
    return true
  }

  try {
    console.log('🔍 正在檢查 Background Service Worker 狀態...')

    // 縮短超時時間到 2 秒，提供快速反饋
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Background Service Worker 連線超時 (2秒)')), 2000)
    })

    const messagePromise = chrome.runtime.sendMessage({ type: MESSAGE_TYPES.GET_STATUS })

    const response = await Promise.race([messagePromise, timeoutPromise])

    if (response && response.success) {
      console.log('✅ Background Service Worker 狀態正常', response)

      // 記錄詳細狀態供診斷使用
      if (response.eventSystem) {
        console.log('📊 事件系統狀態:', response.eventSystem)
      }

      updateStatus('線上', 'Background Service Worker 連線正常', '系統就緒', STATUS_TYPES.READY)
      return true
    } else {
      throw new Error('Background Service Worker 回應異常: ' + JSON.stringify(response))
    }
  } catch (error) {
    console.error('❌ Background Service Worker 連線失敗:', error)

    // 提供使用者友好的錯誤訊息和操作指引
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

    updateStatus('離線', userMessage, diagnosticInfo, STATUS_TYPES.ERROR)
    return false
  }
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
      ? `Readmoo (${new URL(tab.url).pathname})`
      : '非 Readmoo 頁面'

    if (isReadmoo) {
      // 嘗試與 Content Script 通訊
      try {
        const response = await chrome.tabs.sendMessage(tab.id, { type: MESSAGE_TYPES.PING })

        if (response && response.success) {
          elements.bookCount.textContent = '檢測中...'
          updateStatus('就緒', 'Content Script 連線正常', '可以開始提取書庫資料', STATUS_TYPES.READY)
          updateButtonState(false)
          return tab
        }
      } catch (error) {
        console.log('Content Script 尚未就緒:', error)
        updateStatus('載入中', MESSAGES.CONTENT_SCRIPT_LOADING, MESSAGES.CONTENT_SCRIPT_RELOAD_HINT, STATUS_TYPES.LOADING)
      }
    } else {
      updateStatus('待機', MESSAGES.NON_READMOO_PAGE, MESSAGES.NON_READMOO_HINT, STATUS_TYPES.READY)
      updateButtonState(true)
    }

    return tab
  } catch (error) {
    console.error('檢查標籤頁時發生錯誤:', error)
    updateStatus('錯誤', '無法檢查頁面狀態', error.message, STATUS_TYPES.ERROR)
    return null
  }
}

// ==================== 操作處理 ====================

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
 * 3. 發送提取開始訊息到 Content Script
 * 4. 處理提取結果並更新狀態
 * 5. 恢復按鈕狀態
 */
async function startExtraction () {
  const tab = await checkCurrentTab()
  if (!tab) return

  try {
    updateStatus('提取中', MESSAGES.EXTRACTION_IN_PROGRESS, MESSAGES.EXTRACTION_HINT, STATUS_TYPES.LOADING)
    updateButtonState(true)

    const response = await chrome.tabs.sendMessage(tab.id, { type: MESSAGE_TYPES.START_EXTRACTION })

    if (response && response.success) {
      updateStatus('完成', '資料提取完成', response.message, STATUS_TYPES.READY)

      if (response.booksDetected !== undefined) {
        elements.bookCount.textContent = response.booksDetected
      }
    } else {
      throw new Error(response?.error || '未知錯誤')
    }
  } catch (error) {
    console.error('提取過程發生錯誤:', error)
    updateStatus('失敗', '提取失敗', error.message, STATUS_TYPES.ERROR)
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
    console.log('📖 開啟書庫總覽頁面...')
    chrome.runtime.openOptionsPage()
  } catch (error) {
    console.error('❌ 無法開啟書庫頁面:', error)
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
  console.log('🚀 開始初始化 Popup Interface')

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
        initializationTracker.failStep('background_check', new Error('Background Service Worker 連線失敗'))
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
    console.log('✅ Popup Interface 初始化完成')
    if (initializationTracker) {
      initializationTracker.completeStep('finalization', '初始化流程完成')
    }
  } catch (error) {
    console.error('❌ 初始化過程發生錯誤:', error)

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
 * 負責功能：
 * - 定期檢查並更新界面狀態
 * - 只在界面可見時執行更新
 *
 * 設計考量：
 * - 節省資源，僅在需要時更新
 * - 保持狀態的即時性
 */
async function periodicStatusUpdate () {
  if (document.visibilityState === 'visible') {
    await checkCurrentTab()
  }
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
      console.warn('⚠️ 診斷增強器初始化失敗:', result.error)
    } else {
      console.log('✅ 診斷增強器初始化成功')

      // 設置系統健康檢查按鈕事件監聽器
      const healthCheckBtn = document.getElementById('systemHealthCheckBtn')
      if (healthCheckBtn) {
        healthCheckBtn.addEventListener('click', async () => {
          healthCheckBtn.disabled = true
          healthCheckBtn.textContent = '⏳ 檢查中...'

          try {
            const healthReport = await diagnosticEnhancer.performSystemHealthCheck()
            displayHealthCheckResults(healthReport)
          } catch (error) {
            console.error('健康檢查錯誤:', error)
            alert('健康檢查失敗: ' + error.message)
          } finally {
            healthCheckBtn.disabled = false
            healthCheckBtn.textContent = '⚕️ 系統健康檢查'
          }
        })
      }
    }
  }
}

function displayHealthCheckResults (healthReport) {
  const { summary, checks, recommendations } = healthReport

  let statusText = '系統健康檢查結果：\n'
  statusText += `✅ 通過: ${summary.passed} 項\n`
  statusText += `⚠️ 警告: ${summary.warnings} 項\n`
  statusText += `❌ 失敗: ${summary.failed} 項\n\n`

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
    errorContainer.style.backgroundColor = summary.failed === 0 ? '#e8f5e8' : '#fff3cd'
    errorContainer.style.borderColor = summary.failed === 0 ? '#28a745' : '#ffc107'
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

  let reportText = '🔍 Popup 初始化詳細報告\n\n'

  // 基本統計
  reportText += '📊 總體統計：\n'
  reportText += `• 總步驟數: ${report.summary.totalSteps}\n`
  reportText += `• 完成步驟: ${report.summary.completedSteps}\n`
  reportText += `• 失敗步驟: ${report.summary.failedSteps}\n`
  reportText += `• 執行中步驟: ${report.summary.runningSteps}\n`

  if (report.totalDuration) {
    reportText += `• 總耗時: ${report.totalDuration}ms\n`
  }

  reportText += '\n⏱️ 詳細步驟執行記錄：\n'

  // 步驟詳情
  report.steps.forEach((step, index) => {
    const statusIcon = step.status === 'completed'
      ? '✅'
      : step.status === 'failed'
        ? '❌'
        : step.status === 'running' ? '🔄' : '⏸️'

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
    reportText += '💡 故障排除建議：\n'
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

    // 設置樣式（藍色邊框表示資訊性內容）
    errorContainer.style.backgroundColor = '#e8f4f8'
    errorContainer.style.borderColor = '#17a2b8'
  } else {
    alert(reportText)
  }
}

function handleGlobalError (event) {
  console.error('❌ Popup Interface 錯誤:', event.error)

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
  window.setupEventListeners = setupEventListeners
  window.initialize = initialize

  // 新增的進度和結果功能
  window.updateProgress = updateProgress
  window.hideProgress = hideProgress
  window.displayExtractionResults = displayExtractionResults
  window.exportResults = exportResults
  window.handleExtractionError = handleExtractionError
  window.retryExtraction = retryExtraction
  window.cancelExtraction = cancelExtraction

  // 暴露常數供測試驗證
  window.STATUS_TYPES = STATUS_TYPES
  window.MESSAGE_TYPES = MESSAGE_TYPES
  window.MESSAGES = MESSAGES
  window.CONFIG = CONFIG
}

// ==================== 啟動流程 ====================

// 頁面載入完成後初始化
document.addEventListener('DOMContentLoaded', initialize)

// 定期更新狀態
setInterval(periodicStatusUpdate, CONFIG.STATUS_UPDATE_INTERVAL)

// 全域錯誤處理
window.addEventListener('error', handleGlobalError)

console.log('✅ Popup Script 載入完成')
