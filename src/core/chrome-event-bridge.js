/**
 * Chrome Extension 事件橋接器
 * 處理不同腳本環境之間的事件通訊
 * 
 * 負責功能：
 * - 設置Chrome Runtime消息監聽器
 * - 處理跨上下文事件分發
 * - 管理 background ↔ content script ↔ popup 通訊
 * - 提供Promise包裝的Chrome API呼叫
 * - 實現錯誤處理和復原機制
 * - 查詢和管理Readmoo相關分頁
 * 
 * 設計考量：
 * - 使用chrome.runtime.sendMessage和chrome.tabs.sendMessage
 * - 支援非同步事件分發和錯誤隔離
 * - 確保通訊的可靠性和錯誤復原
 * - 保持消息通道開啟以支援雙向通訊
 * 
 * 處理流程：
 * 1. 初始化設置消息監聽器
 * 2. 接收跨上下文事件請求
 * 3. 根據目標上下文路由事件
 * 4. 處理通訊回應和錯誤
 * 5. 返回結果給發送者
 * 
 * 使用情境：
 * - Extension background script 與 content script 通訊
 * - Popup 與 background script 資料交換
 * - 跨分頁的事件同步處理
 * - 多書城網站的統一事件處理
 */
class ChromeEventBridge {
  /**
   * 建構事件橋接器
   * 初始化消息處理器映射並設置Chrome消息監聽器
   */
  constructor() {
    this.messageHandlers = new Map();
    this.setupMessageListeners();
  }

  /**
   * 設定Chrome Runtime消息監聽器
   * 註冊主要的消息路由處理邏輯
   */
  setupMessageListeners() {
    this.messageListener = this.handleMessage.bind(this);
    chrome.runtime.onMessage.addListener(this.messageListener);
  }

  /**
   * 處理Chrome Runtime消息
   * @param {Object} message - 接收到的消息
   * @param {Object} sender - 消息發送者資訊
   * @param {Function} sendResponse - 回應函數
   * @returns {boolean|undefined} 是否保持消息通道開啟
   */
  async handleMessage(message, sender, sendResponse) {
    if (message.type === 'CROSS_CONTEXT_EVENT') {
      // 處理跨上下文事件
      await this.handleCrossContextEvent(message, sender, sendResponse);
      return true; // 保持消息通道開啟
    }
    // 其他消息類型不處理
  }

  /**
   * 處理跨上下文事件
   * @param {Object} message - 跨上下文事件消息
   * @param {Object} sender - 消息發送者
   * @param {Function} sendResponse - 回應函數
   */
  async handleCrossContextEvent(message, sender, sendResponse) {
    const { event, targetContext } = message.data;
    
    try {
      // 在目標上下文中觸發事件
      const result = await this.dispatchToContext(event, targetContext);
      sendResponse({ success: true, result });
    } catch (error) {
      sendResponse({ success: false, error: error.message });
    }
  }

  /**
   * 將事件分發到指定上下文
   * @param {Object} event - 要分發的事件
   * @param {string} targetContext - 目標上下文 ('background', 'content', 'popup')
   * @returns {Promise<any>} 處理結果
   */
  async dispatchToContext(event, targetContext) {
    switch (targetContext) {
      case 'background':
        return await this.dispatchToBackground(event);
      case 'content':
        return await this.dispatchToContent(event);
      case 'popup':
        return await this.dispatchToPopup(event);
      default:
        throw new Error(`Unknown target context: ${targetContext}`);
    }
  }

  /**
   * 發送事件到背景腳本
   * @param {Object} event - 要發送的事件
   * @returns {Promise<any>} 背景腳本的回應
   */
  async dispatchToBackground(event) {
    return new Promise((resolve, reject) => {
      chrome.runtime.sendMessage({
        type: 'BACKGROUND_EVENT',
        event
      }, (response) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
        } else {
          resolve(response);
        }
      });
    });
  }

  /**
   * 發送事件到內容腳本
   * @param {Object} event - 要發送的事件
   * @returns {Promise<Array>} 所有content script的回應結果
   */
  async dispatchToContent(event) {
    const tabs = await this.getReadmooTabs();
    const results = [];
    
    for (const tab of tabs) {
      try {
        const result = await this.sendToTab(tab.id, {
          type: 'CONTENT_EVENT',
          event
        });
        results.push(result);
      } catch (error) {
        console.warn(`Failed to send event to tab ${tab.id}:`, error);
      }
    }
    
    return results;
  }

  /**
   * 發送事件到彈出視窗
   * @param {Object} event - 要發送的事件
   * @returns {Promise<any>} 彈出視窗的回應
   */
  async dispatchToPopup(event) {
    // 暫時使用與background相同的通訊機制
    return await this.dispatchToBackground(event);
  }

  /**
   * 取得Readmoo相關的分頁
   * @returns {Promise<Array>} Readmoo分頁列表
   */
  async getReadmooTabs() {
    return new Promise((resolve) => {
      chrome.tabs.query({
        url: ['*://readmoo.com/*', '*://*.readmoo.com/*']
      }, resolve);
    });
  }

  /**
   * 發送消息到指定分頁
   * @param {number} tabId - 分頁ID
   * @param {Object} message - 要發送的消息
   * @returns {Promise<any>} 分頁的回應
   */
  async sendToTab(tabId, message) {
    return new Promise((resolve, reject) => {
      chrome.tabs.sendMessage(tabId, message, (response) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
        } else {
          resolve(response);
        }
      });
    });
  }

  /**
   * 清理資源並移除事件監聽器
   * 用於測試或extension卸載時的清理工作
   */
  destroy() {
    // 清理消息處理器映射
    this.messageHandlers.clear();
    
    // 移除Chrome消息監聽器
    if (this.messageListener) {
      chrome.runtime.onMessage.removeListener(this.messageListener);
    }
  }
}

module.exports = ChromeEventBridge; 