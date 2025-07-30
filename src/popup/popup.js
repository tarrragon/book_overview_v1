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

console.log('🎨 Popup Interface 載入完成');

// ==================== 常數定義 ====================

/**
 * 狀態類型常數
 */
const STATUS_TYPES = {
  LOADING: 'loading',
  READY: 'ready', 
  ERROR: 'error'
};

/**
 * 訊息類型常數
 */
const MESSAGE_TYPES = {
  PING: 'PING',
  GET_STATUS: 'GET_STATUS',
  START_EXTRACTION: 'START_EXTRACTION'
};

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
};

/**
 * 配置常數
 */
const CONFIG = {
  STATUS_UPDATE_INTERVAL: 3000, // 3 秒
  READMOO_DOMAIN: 'readmoo.com'
};

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
  reportBtn: document.getElementById('reportBtn')
};

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
function updateStatus(status, text, info, type = STATUS_TYPES.LOADING) {
  elements.statusDot.className = `status-dot ${type}`;
  elements.statusText.textContent = text;
  elements.statusInfo.textContent = info;
  elements.extensionStatus.textContent = status;
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
function updateButtonState(disabled, text) {
  elements.extractBtn.disabled = disabled;
  if (text) {
    elements.extractBtn.textContent = text;
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
function updateProgress(percentage, text) {
  if (!elements.progressContainer || !elements.progressBar) return;
  
  // 顯示進度容器
  elements.progressContainer.style.display = 'block';
  
  // 更新進度條寬度
  const progressFill = elements.progressBar.querySelector('.progress-fill');
  if (progressFill) {
    progressFill.style.width = `${Math.min(100, Math.max(0, percentage))}%`;
  }
  
  // 更新進度百分比
  if (elements.progressPercentage) {
    elements.progressPercentage.textContent = `${Math.round(percentage)}%`;
  }
  
  // 更新進度文字
  if (elements.progressText && text) {
    elements.progressText.textContent = text;
  }
}

/**
 * 隱藏進度顯示
 * 
 * 負責功能：
 * - 隱藏進度顯示容器
 * - 重置進度狀態
 */
function hideProgress() {
  if (elements.progressContainer) {
    elements.progressContainer.style.display = 'none';
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
function displayExtractionResults(results) {
  if (!elements.resultsContainer) return;
  
  // 顯示結果容器
  elements.resultsContainer.style.display = 'block';
  
  // 更新結果資訊
  if (elements.extractedBookCount) {
    elements.extractedBookCount.textContent = results.bookCount || 0;
  }
  
  if (elements.extractionTime) {
    elements.extractionTime.textContent = results.extractionTime || '-';
  }
  
  if (elements.successRate) {
    elements.successRate.textContent = results.successRate ? `${results.successRate}%` : '-';
  }
  
  // 啟用操作按鈕
  if (elements.exportBtn) {
    elements.exportBtn.disabled = false;
  }
  
  if (elements.viewResultsBtn) {
    elements.viewResultsBtn.disabled = false;
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
function exportResults() {
  // TODO: 實現結果匯出功能
  window.alert('匯出功能將在後續版本實現');
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
function handleExtractionError(message, error) {
  if (!elements.errorContainer) return;
  
  // 顯示錯誤容器
  elements.errorContainer.style.display = 'block';
  
  // 隱藏進度顯示
  hideProgress();
  
  // 更新錯誤訊息
  if (elements.errorMessage) {
    elements.errorMessage.textContent = message || '發生未知錯誤';
  }
  
  // 記錄詳細錯誤資訊
  if (error) {
    console.error('❌ 提取錯誤詳情:', error);
  }
  
  // 重置按鈕狀態
  updateButtonState(false, '🚀 開始提取書庫資料');
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
function retryExtraction() {
  // 隱藏錯誤容器
  if (elements.errorContainer) {
    elements.errorContainer.style.display = 'none';
  }
  
  // 重新開始提取
  startExtraction();
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
function cancelExtraction() {
  // TODO: 實現取消提取功能
  hideProgress();
  updateButtonState(false, '🚀 開始提取書庫資料');
  updateStatus('擴展就緒', '準備開始提取', '請前往 Readmoo 書庫頁面', STATUS_TYPES.READY);
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
async function checkBackgroundStatus() {
  try {
    const response = await chrome.runtime.sendMessage({ type: MESSAGE_TYPES.GET_STATUS });
    
    if (response && response.success) {
      console.log('✅ Background Service Worker 狀態正常');
      return true;
    } else {
      throw new Error('Background Service Worker 回應異常');
    }
  } catch (error) {
    console.error('❌ Background Service Worker 連線失敗:', error);
    updateStatus('離線', 'Service Worker 離線', '請重新載入擴展', STATUS_TYPES.ERROR);
    return false;
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
async function checkCurrentTab() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    
    if (!tab) {
      updateStatus('無效', '無法取得標籤頁資訊', '請重新整理頁面後再試', STATUS_TYPES.ERROR);
      return null;
    }
    
    // 檢查是否為 Readmoo 頁面
    const isReadmoo = tab.url && tab.url.includes(CONFIG.READMOO_DOMAIN);
    
    elements.pageInfo.textContent = isReadmoo 
      ? `Readmoo (${new URL(tab.url).pathname})`
      : '非 Readmoo 頁面';
    
    if (isReadmoo) {
      // 嘗試與 Content Script 通訊
      try {
        const response = await chrome.tabs.sendMessage(tab.id, { type: MESSAGE_TYPES.PING });
        
        if (response && response.success) {
          elements.bookCount.textContent = '檢測中...';
          updateStatus('就緒', 'Content Script 連線正常', '可以開始提取書庫資料', STATUS_TYPES.READY);
          updateButtonState(false);
          return tab;
        }
      } catch (error) {
        console.log('Content Script 尚未就緒:', error);
        updateStatus('載入中', MESSAGES.CONTENT_SCRIPT_LOADING, MESSAGES.CONTENT_SCRIPT_RELOAD_HINT, STATUS_TYPES.LOADING);
      }
    } else {
      updateStatus('待機', MESSAGES.NON_READMOO_PAGE, MESSAGES.NON_READMOO_HINT, STATUS_TYPES.READY);
      updateButtonState(true);
    }
    
    return tab;
  } catch (error) {
    console.error('檢查標籤頁時發生錯誤:', error);
    updateStatus('錯誤', '無法檢查頁面狀態', error.message, STATUS_TYPES.ERROR);
    return null;
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
async function startExtraction() {
  const tab = await checkCurrentTab();
  if (!tab) return;
  
  try {
    updateStatus('提取中', MESSAGES.EXTRACTION_IN_PROGRESS, MESSAGES.EXTRACTION_HINT, STATUS_TYPES.LOADING);
    updateButtonState(true);
    
    const response = await chrome.tabs.sendMessage(tab.id, { type: MESSAGE_TYPES.START_EXTRACTION });
    
    if (response && response.success) {
      updateStatus('完成', '資料提取完成', response.message, STATUS_TYPES.READY);
      
      if (response.booksDetected !== undefined) {
        elements.bookCount.textContent = response.booksDetected;
      }
    } else {
      throw new Error(response?.error || '未知錯誤');
    }
  } catch (error) {
    console.error('提取過程發生錯誤:', error);
    updateStatus('失敗', '提取失敗', error.message, STATUS_TYPES.ERROR);
  } finally {
    updateButtonState(false);
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
function showSettings() {
  window.alert(MESSAGES.SETTINGS_PLACEHOLDER);
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
function showHelp() {
  window.alert(MESSAGES.HELP_TEXT);
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
function setupEventListeners() {
  // 主要操作按鈕
  elements.extractBtn.addEventListener('click', startExtraction);
  elements.settingsBtn.addEventListener('click', showSettings);
  elements.helpBtn.addEventListener('click', showHelp);
  
  // 結果操作按鈕
  if (elements.exportBtn) {
    elements.exportBtn.addEventListener('click', exportResults);
  }
  
  if (elements.viewResultsBtn) {
    elements.viewResultsBtn.addEventListener('click', () => {
      window.alert('查看詳情功能將在後續版本實現');
    });
  }
  
  // 錯誤處理按鈕
  if (elements.retryBtn) {
    elements.retryBtn.addEventListener('click', retryExtraction);
  }
  
  if (elements.reportBtn) {
    elements.reportBtn.addEventListener('click', () => {
      window.alert('問題回報功能將在後續版本實現');
    });
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
async function initialize() {
  console.log('🚀 開始初始化 Popup Interface');
  
  try {
    // 設定事件監聽器
    setupEventListeners();
    
    // 檢查 Background Service Worker
    const backgroundOk = await checkBackgroundStatus();
    if (!backgroundOk) return;
    
    // 檢查當前標籤頁
    await checkCurrentTab();
    
    console.log('✅ Popup Interface 初始化完成');
  } catch (error) {
    console.error('❌ 初始化過程發生錯誤:', error);
    updateStatus('錯誤', '初始化失敗', error.message, STATUS_TYPES.ERROR);
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
async function periodicStatusUpdate() {
  if (document.visibilityState === 'visible') {
    await checkCurrentTab();
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
function handleGlobalError(event) {
  console.error('❌ Popup Interface 錯誤:', event.error);
  updateStatus('錯誤', '界面發生錯誤', event.error.message, STATUS_TYPES.ERROR);
}

// ==================== 全域範圍暴露 (供測試使用) ====================

// 將關鍵物件和函數暴露到全域範圍供測試使用
if (typeof window !== 'undefined') {
  window.elements = elements;
  window.updateStatus = updateStatus;
  window.updateButtonState = updateButtonState;
  window.checkCurrentTab = checkCurrentTab;
  window.checkBackgroundStatus = checkBackgroundStatus;
  window.startExtraction = startExtraction;
  window.setupEventListeners = setupEventListeners;
  window.initialize = initialize;
  
  // 新增的進度和結果功能
  window.updateProgress = updateProgress;
  window.hideProgress = hideProgress;
  window.displayExtractionResults = displayExtractionResults;
  window.exportResults = exportResults;
  window.handleExtractionError = handleExtractionError;
  window.retryExtraction = retryExtraction;
  window.cancelExtraction = cancelExtraction;
  
  // 暴露常數供測試驗證
  window.STATUS_TYPES = STATUS_TYPES;
  window.MESSAGE_TYPES = MESSAGE_TYPES;
  window.MESSAGES = MESSAGES;
  window.CONFIG = CONFIG;
}

// ==================== 啟動流程 ====================

// 頁面載入完成後初始化
document.addEventListener('DOMContentLoaded', initialize);

// 定期更新狀態
setInterval(periodicStatusUpdate, CONFIG.STATUS_UPDATE_INTERVAL);

// 全域錯誤處理
window.addEventListener('error', handleGlobalError);

console.log('✅ Popup Script 載入完成'); 