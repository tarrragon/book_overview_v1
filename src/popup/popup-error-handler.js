/**
 * Popup 錯誤處理增強模組
 * 
 * 負責功能：
 * - 使用者友善的錯誤訊息轉換
 * - 擴展重新載入功能
 * - 系統初始載入錯誤處理
 * - 診斷建議顯示
 * 
 * 使用情境：
 * - Popup 界面錯誤顯示和處理
 * - 使用者自助故障排除
 * - 診斷模式啟用和控制
 */

// 錯誤配置函數（需要支援瀏覽器環境）
let getUserErrorMessage, getDiagnosticSuggestion;

// 嘗試載入錯誤配置
try {
  if (typeof require !== 'undefined') {
    const errorConfig = require('../config/error-config');
    getUserErrorMessage = errorConfig.getUserErrorMessage;
    getDiagnosticSuggestion = errorConfig.getDiagnosticSuggestion;
  }
} catch (error) {
  console.warn('[PopupErrorHandler] Unable to load error config, using fallback');
  
  // 備用錯誤訊息函數
  getUserErrorMessage = (errorType, defaultMessage) => ({
    title: '系統錯誤',
    message: defaultMessage || '發生未預期的錯誤，請重新載入擴展',
    actions: ['重新載入擴展', '重新整理頁面'],
    severity: 'error'
  });
  
  getDiagnosticSuggestion = () => null;
}

class PopupErrorHandler {
  constructor() {
    this.elements = {};
    this.diagnosticMode = false;
    this.initializationFailed = false;
  }

  /**
   * 初始化錯誤處理器
   */
  initialize() {
    this.initializeElements();
    this.setupEventListeners();
    this.setupGlobalErrorHandling();
    
    console.log('[PopupErrorHandler] Error handler initialized');
  }

  /**
   * 初始化DOM元素引用
   */
  initializeElements() {
    // 系統初始載入錯誤元素
    this.elements.initErrorContainer = document.getElementById('initErrorContainer');
    this.elements.initErrorMessage = document.getElementById('initErrorMessage');
    this.elements.forceReloadBtn = document.getElementById('forceReloadBtn');
    this.elements.openExtensionPageBtn = document.getElementById('openExtensionPageBtn');

    // 一般錯誤元素
    this.elements.errorContainer = document.getElementById('errorContainer');
    this.elements.errorMessage = document.getElementById('errorMessage');
    this.elements.retryBtn = document.getElementById('retryBtn');
    this.elements.reloadExtensionBtn = document.getElementById('reloadExtensionBtn');
    this.elements.reportBtn = document.getElementById('reportBtn');
    
    // 錯誤建議元素
    this.elements.errorSuggestions = document.getElementById('errorSuggestions');
    this.elements.suggestionsList = document.getElementById('suggestionsList');
    
    // 診斷模式按鈕
    this.elements.diagnosticBtn = document.getElementById('diagnosticBtn');
  }

  /**
   * 設置事件監聽器
   */
  setupEventListeners() {
    // 強制重新載入按鈕
    if (this.elements.forceReloadBtn) {
      this.elements.forceReloadBtn.addEventListener('click', () => {
        this.forceReloadExtension();
      });
    }

    // 開啟擴展管理頁面按鈕
    if (this.elements.openExtensionPageBtn) {
      this.elements.openExtensionPageBtn.addEventListener('click', () => {
        this.openExtensionManagePage();
      });
    }

    // 擴展重新載入按鈕
    if (this.elements.reloadExtensionBtn) {
      this.elements.reloadExtensionBtn.addEventListener('click', () => {
        this.reloadExtension();
      });
    }

    // 問題回報按鈕
    if (this.elements.reportBtn) {
      this.elements.reportBtn.addEventListener('click', () => {
        this.handleErrorReport();
      });
    }

    // 診斷模式按鈕
    if (this.elements.diagnosticBtn) {
      this.elements.diagnosticBtn.addEventListener('click', () => {
        this.toggleDiagnosticMode();
      });
    }
  }

  /**
   * 設置全域錯誤處理
   */
  setupGlobalErrorHandling() {
    // 監聽來自錯誤系統的使用者錯誤通知
    if (typeof chrome !== 'undefined' && chrome.runtime) {
      chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
        if (message.type === 'USER_ERROR_NOTIFICATION') {
          this.handleUserErrors(message.errors);
        }
        return false; // 不需要異步回應
      });
    }

    // 監聽初始化錯誤
    window.addEventListener('popup-initialization-error', (event) => {
      this.handleInitializationError(event.detail);
    });
  }

  /**
   * 處理系統初始化錯誤
   */
  handleInitializationError(error) {
    this.initializationFailed = true;
    
    if (this.elements.initErrorContainer) {
      this.elements.initErrorContainer.style.display = 'block';
    }

    if (this.elements.initErrorMessage) {
      const userMessage = getUserErrorMessage('SYSTEM_INITIALIZATION_ERROR', error.message);
      this.elements.initErrorMessage.textContent = userMessage.message;
    }

    // 隱藏正常的UI元素
    const normalElements = ['extractBtn', 'settingsBtn', 'helpBtn'];
    normalElements.forEach(id => {
      const element = document.getElementById(id);
      if (element) {
        element.style.display = 'none';
      }
    });

    // 顯示診斷模式按鈕
    if (this.elements.diagnosticBtn) {
      this.elements.diagnosticBtn.style.display = 'block';
    }

    console.error('[PopupErrorHandler] Initialization failed:', error);
  }

  /**
   * 處理使用者錯誤
   */
  handleUserErrors(errors) {
    if (!errors || errors.length === 0) return;

    // 取得最新的未顯示錯誤
    const latestError = errors[errors.length - 1];
    this.showUserFriendlyError(latestError);

    // 標記錯誤為已顯示
    if (typeof chrome !== 'undefined' && chrome.runtime) {
      chrome.runtime.sendMessage({
        type: 'MARK_ERROR_DISPLAYED',
        errorId: latestError.id
      });
    }
  }

  /**
   * 顯示使用者友善錯誤
   */
  showUserFriendlyError(errorInfo) {
    if (!this.elements.errorContainer || !this.elements.errorMessage) return;

    // 顯示錯誤容器
    this.elements.errorContainer.style.display = 'block';

    // 設置錯誤訊息
    const userMessage = getUserErrorMessage(errorInfo.type, errorInfo.data?.technicalMessage);
    this.elements.errorMessage.textContent = userMessage.message;

    // 顯示建議解決步驟
    if (userMessage.actions && userMessage.actions.length > 0) {
      this.showErrorSuggestions(userMessage.actions);
    }

    // 根據錯誤嚴重程度調整UI
    this.adjustUIForErrorSeverity(userMessage.severity);
  }

  /**
   * 顯示錯誤建議
   */
  showErrorSuggestions(actions) {
    if (!this.elements.errorSuggestions || !this.elements.suggestionsList) return;

    // 清空現有建議
    this.elements.suggestionsList.innerHTML = '';

    // 添加建議項目
    actions.forEach(action => {
      const li = document.createElement('li');
      li.textContent = action;
      this.elements.suggestionsList.appendChild(li);
    });

    // 顯示建議容器
    this.elements.errorSuggestions.style.display = 'block';
  }

  /**
   * 根據錯誤嚴重程度調整UI
   */
  adjustUIForErrorSeverity(severity) {
    if (!this.elements.errorContainer) return;

    // 移除現有的嚴重程度類別
    this.elements.errorContainer.classList.remove('error-critical', 'error-warning', 'error-info');

    // 添加對應的嚴重程度類別
    switch (severity) {
      case 'critical':
        this.elements.errorContainer.classList.add('error-critical');
        break;
      case 'warning':
        this.elements.errorContainer.classList.add('error-warning');
        break;
      case 'info':
        this.elements.errorContainer.classList.add('error-info');
        break;
    }
  }

  /**
   * 強制重新載入擴展
   */
  forceReloadExtension() {
    if (typeof chrome !== 'undefined' && chrome.runtime) {
      try {
        // 嘗試使用 chrome.runtime.reload()
        chrome.runtime.reload();
      } catch (error) {
        console.warn('[PopupErrorHandler] chrome.runtime.reload() failed, trying alternative methods');
        
        // 備用方法：重新載入所有相關分頁
        this.reloadAllExtensionPages();
      }
    }
  }

  /**
   * 重新載入擴展（溫和方式）
   */
  reloadExtension() {
    // 首先嘗試重新初始化
    try {
      // 觸發重新初始化事件
      window.dispatchEvent(new CustomEvent('popup-reinitialize'));
      
      // 隱藏錯誤界面
      this.hideAllErrors();
      
      // 延遲後重新初始化
      setTimeout(() => {
        if (window.initialize && typeof window.initialize === 'function') {
          window.initialize();
        }
      }, 500);
      
    } catch (error) {
      console.warn('[PopupErrorHandler] Soft reload failed, trying force reload');
      this.forceReloadExtension();
    }
  }

  /**
   * 重新載入所有擴展頁面
   */
  reloadAllExtensionPages() {
    if (typeof chrome !== 'undefined' && chrome.tabs) {
      chrome.tabs.query({}, (tabs) => {
        tabs.forEach(tab => {
          if (tab.url && tab.url.startsWith('chrome-extension://')) {
            chrome.tabs.reload(tab.id);
          }
        });
      });
    }
    
    // 重新載入當前 popup
    try {
      window.location.reload();
    } catch (error) {
      console.warn('[PopupErrorHandler] Unable to reload popup window:', error);
      // 在測試環境或某些情況下，reload 可能不可用
    }
  }

  /**
   * 開啟擴展管理頁面
   */
  openExtensionManagePage() {
    if (typeof chrome !== 'undefined' && chrome.tabs) {
      chrome.tabs.create({
        url: 'chrome://extensions/',
        active: true
      });
    }
  }

  /**
   * 處理錯誤回報
   */
  async handleErrorReport() {
    try {
      // 收集診斷資訊
      const diagnosticData = await this.collectDiagnosticData();
      
      // 建立錯誤回報URL
      const reportUrl = this.generateErrorReportURL(diagnosticData);
      
      // 開啟錯誤回報頁面
      if (typeof chrome !== 'undefined' && chrome.tabs) {
        chrome.tabs.create({
          url: reportUrl,
          active: true
        });
      }
      
    } catch (error) {
      console.error('[PopupErrorHandler] Failed to generate error report:', error);
      
      // 備用方案：顯示手動回報指引
      alert(`請手動前往 GitHub Issues 回報問題：
https://github.com/your-repo/readmoo-extractor/issues

請包含以下資訊：
- Chrome 版本：${navigator.userAgent}
- 擴展版本：v0.6.7
- 錯誤時間：${new Date().toLocaleString()}
- 錯誤描述：請詳細描述遇到的問題`);
    }
  }

  /**
   * 收集診斷資料
   */
  async collectDiagnosticData() {
    const diagnosticData = {
      timestamp: Date.now(),
      userAgent: navigator.userAgent,
      extensionVersion: chrome.runtime.getManifest().version,
      url: window.location.href,
      initializationFailed: this.initializationFailed,
      diagnosticMode: this.diagnosticMode
    };

    // 嘗試從錯誤系統取得診斷報告
    try {
      if (typeof chrome !== 'undefined' && chrome.runtime) {
        const response = await chrome.runtime.sendMessage({
          type: 'EXPORT_DIAGNOSTIC_REPORT'
        });
        
        if (response && response.success) {
          diagnosticData.systemReport = response.report;
        }
      }
    } catch (error) {
      console.warn('[PopupErrorHandler] Failed to collect system diagnostic report:', error);
    }

    return diagnosticData;
  }

  /**
   * 生成錯誤回報URL
   */
  generateErrorReportURL(diagnosticData) {
    const baseURL = 'https://github.com/your-repo/readmoo-extractor/issues/new';
    const title = encodeURIComponent('🐛 Bug Report: Popup Error');
    
    const body = encodeURIComponent(`
## 問題描述
請詳細描述遇到的問題：

## 環境資訊
- **Chrome 版本**: ${diagnosticData.userAgent}
- **擴展版本**: ${diagnosticData.extensionVersion}
- **發生時間**: ${new Date(diagnosticData.timestamp).toLocaleString()}
- **初始化失敗**: ${diagnosticData.initializationFailed ? '是' : '否'}

## 診斷資料
\`\`\`json
${JSON.stringify(diagnosticData, null, 2)}
\`\`\`

## 重現步驟
1. 
2. 
3. 

## 預期行為
請描述您預期應該發生什麼：

## 實際行為
請描述實際發生了什麼：
    `);

    return `${baseURL}?title=${title}&body=${body}`;
  }

  /**
   * 切換診斷模式
   */
  toggleDiagnosticMode() {
    this.diagnosticMode = !this.diagnosticMode;
    
    // 更新按鈕文字
    if (this.elements.diagnosticBtn) {
      this.elements.diagnosticBtn.textContent = this.diagnosticMode 
        ? '🔧 停用診斷' 
        : '🔧 診斷模式';
    }

    // 通知錯誤系統
    if (typeof chrome !== 'undefined' && chrome.runtime) {
      chrome.runtime.sendMessage({
        type: this.diagnosticMode ? 'ENABLE_DIAGNOSTIC_MODE' : 'DISABLE_DIAGNOSTIC_MODE'
      });
    }

    console.log(`[PopupErrorHandler] Diagnostic mode ${this.diagnosticMode ? 'enabled' : 'disabled'}`);
  }

  /**
   * 隱藏所有錯誤界面
   */
  hideAllErrors() {
    const errorContainers = [
      this.elements.initErrorContainer,
      this.elements.errorContainer,
      this.elements.errorSuggestions
    ];

    errorContainers.forEach(container => {
      if (container) {
        container.style.display = 'none';
      }
    });
  }

  /**
   * 檢查是否有系統初始化錯誤
   */
  hasInitializationError() {
    return this.initializationFailed;
  }

  /**
   * 重置錯誤狀態
   */
  resetErrorState() {
    this.initializationFailed = false;
    this.hideAllErrors();
    
    // 顯示正常UI元素
    const normalElements = ['extractBtn', 'settingsBtn', 'helpBtn'];
    normalElements.forEach(id => {
      const element = document.getElementById(id);
      if (element) {
        element.style.display = '';
      }
    });

    // 隱藏診斷模式按鈕
    if (this.elements.diagnosticBtn) {
      this.elements.diagnosticBtn.style.display = 'none';
    }
  }
}

// 導出錯誤處理器
if (typeof module !== 'undefined' && module.exports) {
  module.exports = PopupErrorHandler;
} else {
  window.PopupErrorHandler = PopupErrorHandler;
}