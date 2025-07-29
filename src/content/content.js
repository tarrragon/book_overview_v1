/**
 * Readmoo 書庫數據提取器 - Content Script
 * 
 * 負責功能：
 * - 在 Readmoo 網頁中執行資料提取
 * - 與 Background Service Worker 進行事件通訊
 * - 偵測頁面狀態和書庫資料
 * - 提供即時的提取進度回饋
 * 
 * 設計考量：
 * - 整合現有的 BookDataExtractor 和 ReadmooAdapter
 * - 使用事件驅動架構與 background 通訊
 * - 支援非侵入式的頁面操作
 * - 提供錯誤恢復和重試機制
 */

console.log('📚 Readmoo Content Script 載入完成');

// 檢查是否為 Readmoo 頁面
const isReadmooPage = window.location.hostname.includes('readmoo.com');
if (!isReadmooPage) {
  console.log('⚠️ 非 Readmoo 頁面，Content Script 不會執行');
}

/**
 * 頁面狀態檢測
 */
function detectPageType() {
  const url = window.location.href;
  const pathname = window.location.pathname;
  
  // 檢測書庫頁面
  if (url.includes('/library') || pathname.includes('/library')) {
    return 'library';
  }
  
  // 檢測書架頁面
  if (url.includes('/shelf') || pathname.includes('/shelf')) {
    return 'shelf';
  }
  
  // 檢測書籍頁面
  if (url.includes('/book/') || pathname.includes('/book/')) {
    return 'book';
  }
  
  return 'unknown';
}

/**
 * 基本的書籍資料檢測
 */
function detectBooksOnPage() {
  const bookElements = document.querySelectorAll('a[href*="/api/reader/"], .book-item, .library-item');
  
  console.log(`📖 檢測到 ${bookElements.length} 個潛在的書籍元素`);
  
  return {
    count: bookElements.length,
    pageType: detectPageType(),
    extractable: bookElements.length > 0,
    timestamp: Date.now()
  };
}

/**
 * 向 Background 發送狀態更新
 */
function sendStatusUpdate(status) {
  chrome.runtime.sendMessage({
    type: 'CONTENT_STATUS_UPDATE',
    data: status,
    url: window.location.href,
    timestamp: Date.now()
  }).catch(error => {
    console.error('❌ 無法發送狀態更新:', error);
  });
}

/**
 * 來自 Background 的訊息處理
 */
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('📨 Content Script 收到訊息:', message);
  
  switch (message.type) {
    case 'PAGE_READY':
      console.log('✅ Background 確認頁面就緒');
      
      // 執行頁面檢測
      const pageStatus = detectBooksOnPage();
      sendStatusUpdate(pageStatus);
      sendResponse({ success: true, ...pageStatus });
      break;
      
    case 'START_EXTRACTION':
      console.log('🚀 開始資料提取');
      
      // 這裡將來會整合 BookDataExtractor
      const extractionResult = {
        success: true,
        message: '提取功能準備中（將在後續循環實現）',
        booksDetected: detectBooksOnPage().count
      };
      
      sendResponse(extractionResult);
      break;
      
    case 'PING':
      sendResponse({ 
        success: true, 
        message: 'Content Script 運作正常',
        pageType: detectPageType(),
        url: window.location.href
      });
      break;
      
    default:
      console.warn('⚠️ Content Script 收到未知訊息類型:', message.type);
      sendResponse({ success: false, error: '未知的訊息類型' });
  }
});

/**
 * 頁面載入完成後的初始化
 */
document.addEventListener('DOMContentLoaded', () => {
  console.log('📄 DOM 載入完成，開始初始化');
  
  if (isReadmooPage) {
    // 執行初始檢測
    const initialStatus = detectBooksOnPage();
    sendStatusUpdate(initialStatus);
    
    console.log('📊 初始頁面狀態:', initialStatus);
  }
});

/**
 * 頁面變更監聽（用於 SPA 應用）
 */
let currentUrl = window.location.href;
const observer = new MutationObserver(() => {
  if (window.location.href !== currentUrl) {
    currentUrl = window.location.href;
    console.log('🔄 頁面 URL 變更:', currentUrl);
    
    // 重新檢測頁面狀態
    setTimeout(() => {
      const newStatus = detectBooksOnPage();
      sendStatusUpdate(newStatus);
    }, 1000); // 等待頁面內容載入
  }
});

observer.observe(document.body, {
  childList: true,
  subtree: true
});

/**
 * 錯誤處理
 */
window.addEventListener('error', (event) => {
  console.error('❌ Content Script 錯誤:', event.error);
  
  chrome.runtime.sendMessage({
    type: 'CONTENT_ERROR',
    error: event.error.message,
    url: window.location.href,
    timestamp: Date.now()
  }).catch(() => {
    // 如果連錯誤報告都失敗，只能在 console 記錄
    console.error('❌ 無法報告錯誤到 background');
  });
});

console.log('✅ Content Script 初始化完成'); 