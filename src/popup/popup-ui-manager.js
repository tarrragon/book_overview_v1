/**
 * PopupUIManager - 統一 DOM 管理器 (TDD 循環 #36 Refactor Phase)
 * 
 * 負責功能：
 * - 統一管理所有 popup DOM 元素
 * - 提供統一的元素存取 API
 * - 支援事件綁定和解綁
 * - 統一的狀態顯示更新
 * - 進度條管理
 * - 錯誤訊息顯示
 * - 與現有事件驅動架構整合
 * 
 * 設計考量：
 * - 集中化的 DOM 操作管理，採用配置化設計
 * - 統一的 API 接口設計，遵循單一責任原則
 * - 批次 DOM 更新機制，提升效能
 * - 完善的錯誤處理和邊界情況管理
 * - 與現有系統的向後相容性
 * - Chrome Extension 環境相容
 * 
 * 重構改善：
 * - 分離 DOM 操作和業務邏輯
 * - 消除硬編碼字串和重複程式碼
 * - 改善效能和記憶體使用
 * - 強化錯誤處理機制
 * 
 * 使用情境：
 * - Popup 界面的統一 DOM 管理
 * - 與 PopupEventController 和 PopupErrorHandler 整合
 * - 提供統一的 UI 狀態管理介面
 */

class PopupUIManager {
  /**
   * 建構 PopupUIManager
   * 
   * 負責功能：
   * - 初始化 DOM 元素引用
   * - 設定事件監聽管理
   * - 配置預設狀態
   * - 建立配置化的元素管理系統
   */
  constructor() {
    // 配置化的元素定義
    this.elementConfig = this._createElementConfig();
    
    // DOM 元素快取
    this.elements = {};
    
    // 文件物件來源（測試環境優先使用 globalThis.document）
    this.document = (typeof globalThis !== 'undefined' && globalThis.document)
      ? globalThis.document
      : (typeof window !== 'undefined' ? window.document : null);
    
    // 事件監聽器快取
    this.eventListeners = new Map();
    
    // UI 狀態
    this.currentState = {
      loading: false,
      error: null,
      progress: 0,
      status: null
    };
    
    // DOM 更新批次處理
    this.updateQueue = [];
    this.updateScheduled = false;
    
    // 錯誤操作映射表（消除硬編碼）
    this.actionButtonMapping = {
      '重試': 'retryButton',
      '重新載入': 'reloadButton', 
      '診斷': 'diagnosticButton'
    };
    
    // 初始化
    this.initialize();
  }

  /**
   * 創建元素配置定義
   * 
   * @returns {Object} 元素配置對象
   * @private
   */
  _createElementConfig() {
    return {
      status: {
        container: 'status-container',
        message: 'status-message',
        progressBar: 'progress-bar'
      },
      error: {
        container: 'error-container',
        title: 'error-title',
        message: 'error-message',
        actions: 'error-actions',
        retryButton: 'retry-button',
        reloadButton: 'reload-button',
        diagnosticButton: 'diagnostic-button'
      },
      success: {
        container: 'success-container',
        message: 'success-message'
      },
      actions: {
        container: 'action-buttons',
        extractButton: 'extract-button',
        exportButton: 'export-button',
        settingsButton: 'settings-button'
      },
      diagnostic: {
        panel: 'diagnostic-panel',
        content: 'diagnostic-content',
        closeButton: 'close-diagnostic'
      },
      loading: {
        overlay: 'loading-overlay',
        spinner: 'loading-spinner'
      }
    };
  }

  /**
   * 初始化 PopupUIManager
   * 
   * 負責功能：
   * - 收集並快取所有 DOM 元素引用
   * - 優化 DOM 查詢效能
   * - 驗證關鍵元素存在
   */
  initialize() {
    this.cacheElements();
  }

  /**
   * 快取所有 DOM 元素引用（配置化重構版）
   * 
   * 負責功能：
   * - 根據配置定義批次查詢並快取 DOM 元素
   * - 避免重複的 DOM 查詢操作
   * - 提供統一的錯誤處理機制
   * - 分類組織元素引用
   * 
   * 設計考量：
   * - 使用配置驅動的元素查詢，提升可維護性
   * - 統一的元素不存在處理邏輯
   * - 支援動態元素檢查和警告
   */
  cacheElements() {
    const doc = this.document || (typeof globalThis !== 'undefined' && globalThis.document) || (typeof window !== 'undefined' ? window.document : null);
    if (!doc) {
      console.warn('[PopupUIManager] No document available for element caching');
      return;
    }

    const capitalize = (str) => str.charAt(0).toUpperCase() + str.slice(1);

    Object.keys(this.elementConfig).forEach(category => {
      const categoryConfig = this.elementConfig[category];
      
      Object.keys(categoryConfig).forEach(elementKey => {
        const elementId = categoryConfig[elementKey];
        let element = doc.getElementById(elementId);
        if (!element) {
          const altDoc = (typeof document !== 'undefined') ? document : null;
          if (altDoc && altDoc !== doc) {
            element = altDoc.getElementById(elementId);
          }
        }
        
        if (element) {
          // 通用鍵（例如 progressBar）
          this.elements[elementKey] = element;
          
          // 分類前綴的鍵（例如 errorContainer、statusMessage）
          const prefixedKey = `${category}${capitalize(elementKey)}`;
          this.elements[prefixedKey] = element;
          
          // 針對常見鍵建立向後相容別名（例如 error-container => errorContainer 等）
          if (category === 'error') {
            if (elementKey === 'container') this.elements.errorContainer = element;
            if (elementKey === 'title') this.elements.errorTitle = element;
            if (elementKey === 'message') this.elements.errorMessage = element;
            if (elementKey === 'actions') this.elements.errorActions = element;
          }
          if (category === 'status') {
            if (elementKey === 'container') this.elements.statusContainer = element;
            if (elementKey === 'message') this.elements.statusMessage = element;
          }
          if (category === 'success') {
            if (elementKey === 'container') this.elements.successContainer = element;
            if (elementKey === 'message') this.elements.successMessage = element;
          }
          if (category === 'loading') {
            if (elementKey === 'overlay') this.elements.loadingOverlay = element;
          }
        } else {
          // 記錄缺失的元素但不中斷執行
          console.warn(`[PopupUIManager] Element not found: ${elementId}`);
        }
      });
    });
    
    // 驗證關鍵元素存在
    this._validateCriticalElements();
  }
  
  /**
   * 驗證關鍵元素存在
   * 
   * 負責功能：
   * - 檢查核心功能必需的 DOM 元素
   * - 提供降級處理建議
   * 
   * @private
   */
  _validateCriticalElements() {
    // 實際檢查元素映射
    const criticalElementKeys = [
      'statusContainer', 'statusMessage', 'progressBar', 'errorContainer'
    ];
    const missingCritical = criticalElementKeys.filter(key => !this.elements[key]);
    if (missingCritical.length > 0) {
      console.warn(`[PopupUIManager] Missing critical elements: ${missingCritical.join(', ')}`);
    }
  }

  /**
   * 顯示錯誤訊息
   * 
   * @param {Object} errorData - 錯誤資料物件
   * @param {string} errorData.title - 錯誤標題
   * @param {string} errorData.message - 錯誤訊息
   * @param {Array} errorData.actions - 可用操作列表
   * 
   * 負責功能：
   * - 顯示錯誤容器
   * - 更新錯誤標題和訊息
   * - 處理錯誤操作按鈕
   */
  showError(errorData) {
    if (!errorData || !this.elements.errorContainer) {
      return;
    }

    // 顯示錯誤容器
    this.elements.errorContainer.classList.remove('hidden');
    
    // 更新錯誤標題
    if (this.elements.errorTitle && errorData.title) {
      this.elements.errorTitle.textContent = errorData.title;
    }
    
    // 更新錯誤訊息
    if (this.elements.errorMessage && errorData.message) {
      this.elements.errorMessage.textContent = errorData.message;
    }
    
    // 處理錯誤操作
    if (errorData.actions && Array.isArray(errorData.actions)) {
      this.updateErrorActions(errorData.actions);
    }

    this.currentState.error = errorData;
  }

  /**
   * 更新錯誤操作按鈕（重構版：消除硬編碼）
   * 
   * @param {Array} actions - 操作列表
   * @private
   * 
   * 設計考量：
   * - 使用映射表消除硬編碼字串比較
   * - 統一的按鈕顯示邏輯
   * - 支援未知操作的日誌記錄
   */
  updateErrorActions(actions) {
    if (!this.elements.errorActions || !Array.isArray(actions)) {
      return;
    }

    // 首先隱藏所有錯誤操作按鈕
    this._hideAllErrorActionButtons();
    
    // 根據操作列表顯示對應按鈕
    actions.forEach(action => {
      const buttonKey = this.actionButtonMapping[action];
      if (buttonKey && this.elements[buttonKey]) {
        this._showElement(this.elements[buttonKey]);
      } else {
        console.warn(`[PopupUIManager] Unknown error action: ${action}`);
      }
    });
  }
  
  /**
   * 隱藏所有錯誤操作按鈕
   * 
   * @private
   */
  _hideAllErrorActionButtons() {
    Object.values(this.actionButtonMapping).forEach(buttonKey => {
      if (this.elements[buttonKey]) {
        this._hideElement(this.elements[buttonKey]);
      }
    });
  }

  /**
   * 顯示成功訊息（重構版：統一顯示邏輯）
   * 
   * @param {string} message - 成功訊息
   * 
   * 負責功能：
   * - 顯示成功狀態容器
   * - 更新成功訊息文字
   * - 使用統一的元素顯示機制
   */
  showSuccess(message) {
    if (!message || typeof message !== 'string') {
      console.warn('[PopupUIManager] showSuccess: Invalid message provided');
      return;
    }

    // 使用統一的顯示邏輯
    this._showContainerWithMessage('successContainer', 'successMessage', message);
  }

  /**
   * 顯示載入狀態（重構版：統一顯示邏輯）
   * 
   * @param {string} message - 載入訊息
   * 
   * 負責功能：
   * - 顯示載入覆蓋層
   * - 更新載入訊息
   * - 統一狀態管理
   */
  showLoading(message) {
    if (!this.elements.loadingOverlay) {
      console.warn('[PopupUIManager] showLoading: Loading overlay element not found');
      return;
    }

    this._showElement(this.elements.loadingOverlay);
    
    if (message && this.elements.loadingSpinner) {
      this._updateElementText(this.elements.loadingSpinner, message);
    }

    this.currentState.loading = true;
  }

  /**
   * 隱藏載入狀態（重構版：統一隱藏邏輯）
   * 
   * 負責功能：
   * - 隱藏載入覆蓋層
   * - 統一狀態管理
   */
  hideLoading() {
    if (this.elements.loadingOverlay) {
      this._hideElement(this.elements.loadingOverlay);
    }

    this.currentState.loading = false;
  }

  /**
   * 更新進度條（重構版：批次處理優化）
   * 
   * @param {number} percentage - 進度百分比 (0-100)
   * 
   * 負責功能：
   * - 更新進度條寬度
   * - 限制進度值在有效範圍內
   * - 使用批次更新機制提升效能
   * 
   * 設計考量：
   * - 移除不合理的 setTimeout 機制
   * - 採用 requestAnimationFrame 進行批次更新
   * - 提供更準確的更新去重機制
   */
  updateProgress(percentage) {
    if (!this.elements.progressBar || typeof percentage !== 'number') {
      return;
    }

    // 限制進度在 0-100 範圍內
    const clampedPercentage = Math.max(0, Math.min(100, percentage));
    
    // 如果進度沒有變化，不進行更新
    if (this.currentState.progress === clampedPercentage) {
      return;
    }
    
    // 加入更新佇列進行批次處理
    this._queueUpdate(() => {
      if (this.elements.progressBar) {
        this.elements.progressBar.style.width = `${clampedPercentage}%`;
        this.currentState.progress = clampedPercentage;
      }
    });
  }

  // ===== DOM 操作工具方法 =====
  
  /**
   * 統一的元素顯示方法
   * 
   * @param {HTMLElement} element - 要顯示的元素
   * @private
   */
  _showElement(element) {
    if (element) {
      element.classList.remove('hidden');
      element.style.display = element.style.display === 'none' ? '' : element.style.display;
    }
  }
  
  /**
   * 統一的元素隱藏方法
   * 
   * @param {HTMLElement} element - 要隱藏的元素
   * @private
   */
  _hideElement(element) {
    if (element) {
      element.classList.add('hidden');
    }
  }
  
  /**
   * 統一的元素文字更新方法
   * 
   * @param {HTMLElement} element - 要更新的元素
   * @param {string} text - 新文字內容
   * @private
   */
  _updateElementText(element, text) {
    if (element && typeof text === 'string') {
      element.textContent = text;
    }
  }
  
  /**
   * 統一的容器與訊息顯示方法
   * 
   * @param {string} containerKey - 容器元素的鍵名
   * @param {string} messageKey - 訊息元素的鍵名
   * @param {string} message - 訊息內容
   * @private
   */
  _showContainerWithMessage(containerKey, messageKey, message) {
    const container = this.elements[containerKey];
    const messageElement = this.elements[messageKey];
    
    if (!container) {
      console.warn(`[PopupUIManager] Container element not found: ${containerKey}`);
      return;
    }
    
    this._showElement(container);
    
    if (messageElement) {
      this._updateElementText(messageElement, message);
    }
  }
  
  /**
   * DOM 更新佇列處理
   * 
   * @param {Function} updateFn - 更新函數
   * @private
   */
  _queueUpdate(updateFn) {
    this.updateQueue.push(updateFn);
    
    if (!this.updateScheduled) {
      this.updateScheduled = true;
      
      // 使用 requestAnimationFrame 進行批次更新
      if (typeof requestAnimationFrame !== 'undefined') {
        requestAnimationFrame(() => this._processUpdateQueue());
      } else {
        // 在測試/Node 環境中立即處理，避免斷言時機問題
        this._processUpdateQueue();
      }
    }
  }
  
  /**
   * 處理 DOM 更新佇列
   * 
   * @private
   */
  _processUpdateQueue() {
    const updates = [...this.updateQueue];
    this.updateQueue = [];
    this.updateScheduled = false;
    
    updates.forEach(updateFn => {
      try {
        updateFn();
      } catch (error) {
        console.error('[PopupUIManager] Update failed:', error);
      }
    });
  }
  
  // ===== 事件管理方法 =====
  
  /**
   * 綁定事件監聽器（重構版：增強錯誤處理）
   * 
   * @param {string} elementId - 元素 ID
   * @param {string} eventType - 事件類型
   * @param {Function} callback - 回調函數
   * 
   * 負責功能：
   * - 為指定元素綁定事件監聽器
   * - 管理事件監聽器快取
   * - 支援事件清理
   * - 增強錯誤處理和驗證
   */
  bindEvent(elementId, eventType, callback) {
    if (!elementId || !eventType || typeof callback !== 'function') {
      console.warn('[PopupUIManager] bindEvent: Invalid parameters provided');
      return false;
    }
    
    const doc = this.document || (typeof globalThis !== 'undefined' && globalThis.document) || (typeof window !== 'undefined' ? window.document : null);
    const element = doc ? doc.getElementById(elementId) : null;
    if (!element) {
      console.warn(`[PopupUIManager] bindEvent: Element not found: ${elementId}`);
      return false;
    }

    // 綁定事件
    element.addEventListener(eventType, callback);
    
    // 快取事件監聽器資訊
    const key = `${elementId}_${eventType}`;
    this.eventListeners.set(key, {
      element,
      eventType,
      callback
    });
    
    return true;
  }

  /**
   * 顯示診斷面板（重構版：統一顯示邏輯）
   * 
   * @param {string} content - 診斷內容
   * 
   * 負責功能：
   * - 顯示診斷面板
   * - 更新診斷內容
   * - 使用統一的顯示機制
   */
  showDiagnostic(content) {
    if (!content || typeof content !== 'string') {
      console.warn('[PopupUIManager] showDiagnostic: Invalid content provided');
      return;
    }
    
    this._showContainerWithMessage('diagnosticPanel', 'diagnosticContent', content);
  }

  /**
   * 隱藏診斷面板（重構版：統一隱藏邏輯）
   * 
   * 負責功能：
   * - 隱藏診斷面板
   * - 使用統一的隱藏機制
   */
  hideDiagnostic() {
    if (this.elements.diagnosticPanel) {
      this._hideElement(this.elements.diagnosticPanel);
    }
  }

  /**
   * 顯示錯誤（相容性方法，與現有 PopupErrorHandler 整合）
   * 
   * @param {Object} errorData - 錯誤資料
   * 
   * 負責功能：
   * - 提供與現有錯誤處理系統的相容介面
   * - 支援現有的錯誤顯示格式
   */
  displayError(errorData) {
    this.showError(errorData);
  }

  /**
   * 處理狀態事件（事件驅動更新支援）
   * 
   * @param {Object} statusEvent - 狀態事件物件
   * @param {string} statusEvent.type - 事件類型
   * @param {Object} statusEvent.data - 事件資料
   * 
   * 負責功能：
   * - 支援事件驅動的狀態更新
   * - 處理不同類型的狀態事件
   */
  handleStatusEvent(statusEvent) {
    if (!statusEvent || !statusEvent.type) {
      return;
    }

    switch (statusEvent.type) {
      case 'STATUS_UPDATE':
        if (statusEvent.data) {
          this.updateStatusMessage(statusEvent.data.message);
          if (statusEvent.data.progress !== undefined) {
            this.updateProgress(statusEvent.data.progress);
          }
        }
        break;
      
      default:
        console.warn(`[PopupUIManager] Unknown status event type: ${statusEvent.type}`);
    }
  }

  /**
   * 更新狀態訊息（重構版：統一更新邏輯）
   * 
   * @param {string} message - 狀態訊息
   * 
   * 負責功能：
   * - 更新主要狀態訊息顯示
   * - 使用統一的文字更新機制
   */
  updateStatusMessage(message) {
    if (!message || typeof message !== 'string') {
      console.warn('[PopupUIManager] updateStatusMessage: Invalid message provided');
      return;
    }
    
    if (this.elements.statusMessage) {
      this._updateElementText(this.elements.statusMessage, message);
      this.currentState.status = message;
    }
  }

  /**
   * 相容別名：updateStatus → updateStatusMessage
   * 部分整合測試使用舊名稱，維持向後相容
   */
  updateStatus(message) {
    this.updateStatusMessage(message);
  }

  /**
   * 清理事件監聽器（重構版：完善清理機制）
   * 
   * 負責功能：
   * - 移除所有綁定的事件監聽器
   * - 防止記憶體洩漏
   * - 清理快取的事件資訊
   * - 清理更新佇列
   */
  cleanup() {
    // 清理事件監聽器
    this.eventListeners.forEach(({ element, eventType, callback }) => {
      if (element && element.removeEventListener) {
        element.removeEventListener(eventType, callback);
      }
    });
    
    this.eventListeners.clear();
    
    // 清理更新佇列
    this.updateQueue = [];
    this.updateScheduled = false;
    
    // 重置狀態
    this.currentState = {
      loading: false,
      error: null,
      progress: 0,
      status: null
    };
  }

  /**
   * 取得目前狀態資訊（重構版：增強診斷資訊）
   * 
   * @returns {Object} 目前狀態物件
   * 
   * 負責功能：
   * - 提供目前 UI 狀態的快照
   * - 支援狀態檢查和除錯
   * - 提供更多診斷資訊
   */
  getCurrentState() {
    return {
      ...this.currentState,
      queuedUpdates: this.updateQueue.length,
      updateScheduled: this.updateScheduled,
      elementsCount: Object.keys(this.elements).length,
      listenersCount: this.eventListeners.size,
      timestamp: Date.now()
    };
  }

  /**
   * 重置 UI 狀態（重構版：統一重置邏輯）
   * 
   * 負責功能：
   * - 隱藏所有動態容器
   * - 重置狀態為初始值
   * - 清理更新佇列
   */
  reset() {
    // 使用統一的隱藏方法隱藏所有容器
    const containersToHide = [
      'errorContainer',
      'successContainer', 
      'diagnosticPanel',
      'loadingOverlay'
    ];

    containersToHide.forEach(containerKey => {
      if (this.elements[containerKey]) {
        this._hideElement(this.elements[containerKey]);
      }
    });

    // 重置進度
    this.updateProgress(0);
    
    // 清理更新佇列
    this.updateQueue = [];
    this.updateScheduled = false;

    // 重置狀態
    this.currentState = {
      loading: false,
      error: null,
      progress: 0,
      status: null
    };
  }
}

// CommonJS 匯出 (Node.js 環境)
if (typeof module !== 'undefined' && module.exports) {
  module.exports = PopupUIManager;
}

// 瀏覽器全域匯出 (Chrome Extension 環境)
if (typeof window !== 'undefined') {
  window.PopupUIManager = PopupUIManager;
}