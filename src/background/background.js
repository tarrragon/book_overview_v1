/**
 * Readmoo 書庫數據提取器 - Background Service Worker
 * 
 * 負責功能：
 * - 作為事件系統的核心運行環境
 * - 協調 Content Script 和 Popup 之間的通訊
 * - 管理擴展的生命週期和狀態
 * - 處理儲存操作和資料管理
 * 
 * 設計考量：
 * - 使用 Manifest V3 Service Worker 架構
 * - 整合現有的 EventBus 和 ChromeEventBridge 系統
 * - 支援跨上下文事件通訊
 * - 提供統一的錯誤處理和日誌記錄
 */

console.log('🚀 Readmoo 書庫提取器 Background Service Worker 啟動');

// 擴展安裝時的初始化
chrome.runtime.onInstalled.addListener((details) => {
  console.log('📦 擴展安裝完成', details);
  
  // 設定預設配置
  chrome.storage.local.set({
    isEnabled: true,
    extractionSettings: {
      autoExtract: false,
      progressTracking: true,
      dataValidation: true
    },
    version: chrome.runtime.getManifest().version
  });
});

// Service Worker 啟動
chrome.runtime.onStartup.addListener(() => {
  console.log('🔄 Service Worker 重新啟動');
});

// 來自 Content Script 和 Popup 的訊息處理
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('📨 收到訊息:', message, '來自:', sender);
  
  // 基本的訊息路由處理
  switch (message.type) {
    case 'PING':
      sendResponse({ success: true, message: 'Background Service Worker 運作正常' });
      break;
      
    case 'GET_STATUS':
      chrome.storage.local.get(['isEnabled'], (result) => {
        sendResponse({ 
          success: true, 
          isEnabled: result.isEnabled ?? true,
          serviceWorkerActive: true
        });
      });
      return true; // 保持訊息通道開啟用於異步回應
      
    default:
      console.warn('⚠️ 未知的訊息類型:', message.type);
      sendResponse({ success: false, error: '未知的訊息類型' });
  }
});

// 標籤頁更新監聽（用於偵測 Readmoo 頁面）
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tab.url) {
    const isReadmooPage = tab.url.includes('readmoo.com');
    
    if (isReadmooPage) {
      console.log('📚 檢測到 Readmoo 頁面:', tab.url);
      
      // 可以在這裡觸發頁面準備事件
      chrome.tabs.sendMessage(tabId, {
        type: 'PAGE_READY',
        url: tab.url,
        timestamp: Date.now()
      }).catch(error => {
        // Content Script 可能還未載入，這是正常的
        console.log('📝 Content Script 尚未就緒:', error.message);
      });
    }
  }
});

// 錯誤處理
self.addEventListener('error', (event) => {
  console.error('❌ Service Worker 錯誤:', event.error);
});

self.addEventListener('unhandledrejection', (event) => {
  console.error('❌ 未處理的 Promise 拒絕:', event.reason);
});

console.log('✅ Background Service Worker 初始化完成'); 