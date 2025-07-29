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
 */

console.log('🎨 Popup Interface 載入完成');

// DOM 元素引用
const elements = {
  statusDot: document.getElementById('statusDot'),
  statusText: document.getElementById('statusText'),
  statusInfo: document.getElementById('statusInfo'),
  extractBtn: document.getElementById('extractBtn'),
  settingsBtn: document.getElementById('settingsBtn'),
  helpBtn: document.getElementById('helpBtn'),
  pageInfo: document.getElementById('pageInfo'),
  bookCount: document.getElementById('bookCount'),
  extensionStatus: document.getElementById('extensionStatus')
};

/**
 * 更新狀態顯示
 */
function updateStatus(status, text, info, type = 'loading') {
  elements.statusDot.className = `status-dot ${type}`;
  elements.statusText.textContent = text;
  elements.statusInfo.textContent = info;
  
  // 更新擴展狀態顯示
  elements.extensionStatus.textContent = status;
}

/**
 * 檢查當前標籤頁狀態
 */
async function checkCurrentTab() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    
    if (!tab) {
      updateStatus('無效', '無法取得標籤頁資訊', '請重新整理頁面後再試', 'error');
      return null;
    }
    
    // 檢查是否為 Readmoo 頁面
    const isReadmoo = tab.url && tab.url.includes('readmoo.com');
    
    elements.pageInfo.textContent = isReadmoo 
      ? `Readmoo (${new URL(tab.url).pathname})`
      : '非 Readmoo 頁面';
    
    if (isReadmoo) {
      // 嘗試與 Content Script 通訊
      try {
        const response = await chrome.tabs.sendMessage(tab.id, { type: 'PING' });
        
        if (response && response.success) {
          elements.bookCount.textContent = '檢測中...';
          updateStatus('就緒', 'Content Script 連線正常', '可以開始提取書庫資料', 'ready');
          elements.extractBtn.disabled = false;
          return tab;
        }
      } catch (error) {
        console.log('Content Script 尚未就緒:', error);
        updateStatus('載入中', 'Content Script 載入中', '請稍候或重新整理頁面', 'loading');
      }
    } else {
      updateStatus('待機', '請前往 Readmoo 網站', '需要在 Readmoo 書庫頁面使用此功能', 'ready');
      elements.extractBtn.disabled = true;
    }
    
    return tab;
  } catch (error) {
    console.error('檢查標籤頁時發生錯誤:', error);
    updateStatus('錯誤', '無法檢查頁面狀態', error.message, 'error');
    return null;
  }
}

/**
 * 檢查 Background Service Worker 狀態
 */
async function checkBackgroundStatus() {
  try {
    const response = await chrome.runtime.sendMessage({ type: 'GET_STATUS' });
    
    if (response && response.success) {
      console.log('✅ Background Service Worker 狀態正常');
      return true;
    } else {
      throw new Error('Background Service Worker 回應異常');
    }
  } catch (error) {
    console.error('❌ Background Service Worker 連線失敗:', error);
    updateStatus('離線', 'Service Worker 離線', '請重新載入擴展', 'error');
    return false;
  }
}

/**
 * 開始資料提取
 */
async function startExtraction() {
  const tab = await checkCurrentTab();
  if (!tab) return;
  
  try {
    updateStatus('提取中', '正在提取書庫資料', '請保持頁面開啟，不要關閉瀏覽器', 'loading');
    elements.extractBtn.disabled = true;
    
    const response = await chrome.tabs.sendMessage(tab.id, { type: 'START_EXTRACTION' });
    
    if (response && response.success) {
      updateStatus('完成', '資料提取完成', response.message, 'ready');
      
      if (response.booksDetected !== undefined) {
        elements.bookCount.textContent = response.booksDetected;
      }
    } else {
      throw new Error(response?.error || '未知錯誤');
    }
  } catch (error) {
    console.error('提取過程發生錯誤:', error);
    updateStatus('失敗', '提取失敗', error.message, 'error');
  } finally {
    elements.extractBtn.disabled = false;
  }
}

/**
 * 事件監聽器設定
 */
function setupEventListeners() {
  // 提取按鈕
  elements.extractBtn.addEventListener('click', startExtraction);
  
  // 設定按鈕
  elements.settingsBtn.addEventListener('click', () => {
    // 這裡將來會開啟設定頁面
    alert('設定功能將在後續版本實現');
  });
  
  // 說明按鈕
  elements.helpBtn.addEventListener('click', () => {
    // 這裡將來會開啟說明頁面
    alert('使用說明：\n\n1. 前往 Readmoo 書庫頁面\n2. 點擊「開始提取書庫資料」\n3. 等待提取完成\n\n詳細說明將在後續版本提供');
  });
}

/**
 * 初始化函數
 */
async function initialize() {
  console.log('🚀 開始初始化 Popup Interface');
  
  // 設定事件監聽器
  setupEventListeners();
  
  // 檢查 Background Service Worker
  const backgroundOk = await checkBackgroundStatus();
  if (!backgroundOk) return;
  
  // 檢查當前標籤頁
  await checkCurrentTab();
  
  console.log('✅ Popup Interface 初始化完成');
}

/**
 * 頁面載入完成後初始化
 */
document.addEventListener('DOMContentLoaded', initialize);

/**
 * 定期更新狀態（每 3 秒）
 */
setInterval(async () => {
  if (document.visibilityState === 'visible') {
    await checkCurrentTab();
  }
}, 3000);

/**
 * 錯誤處理
 */
window.addEventListener('error', (event) => {
  console.error('❌ Popup Interface 錯誤:', event.error);
  updateStatus('錯誤', '界面發生錯誤', event.error.message, 'error');
});

console.log('✅ Popup Script 載入完成'); 