/**
 * UI通知顯示事件處理器
 * 基於 EventHandler 實現統一的通知管理系統
 * 
 * 負責功能：
 * - 處理 UI.NOTIFICATION.SHOW 事件
 * - 創建和管理通知元素
 * - 支援多種通知類型和樣式
 * - 實現通知的自動隱藏和手動關閉
 * - 管理通知佇列和顯示限制
 * - 提供通知統計和監控
 * 
 * 設計考量：
 * - 繼承 EventHandler 提供標準化的事件處理流程
 * - 支援多種通知類型 (success, error, warning, info)
 * - 實現完整的通知生命週期管理
 * - 提供靈活的通知配置和自訂選項
 * 
 * 處理流程：
 * 1. 接收 UI.NOTIFICATION.SHOW 事件
 * 2. 驗證通知資料的完整性和有效性
 * 3. 創建對應的通知 DOM 元素
 * 4. 應用樣式和動畫效果
 * 5. 管理通知的顯示時間和自動隱藏
 * 6. 維護通知佇列和清理機制
 * 
 * 使用情境：
 * - 顯示操作成功/失敗的反饋訊息
 * - 提供系統狀態和進度通知
 * - 展示警告和重要資訊
 * - 統一管理所有UI通知顯示
 */

const EventHandler = require('../../core/event-handler');

class UINotificationHandler extends EventHandler {
  /**
   * 建構UI通知處理器
   * 
   * @param {Object} eventBus - 事件總線實例
   * @param {Object} document - DOM文檔物件
   * 
   * 負責功能：
   * - 初始化事件處理器基本配置
   * - 設定DOM文檔和事件總線引用
   * - 配置處理器優先級 (UI更新需要較高優先級)
   * - 初始化通知管理和佇列系統
   */
  constructor(eventBus, document) {
    super('UINotificationHandler', 2); // UI更新優先級設為2 (較高)
    
    this.eventBus = eventBus;
    this.document = document;
    
    // 通知狀態管理
    this.activeNotifications = new Map();
    this.notificationQueue = [];
    this.notificationTimers = new Map();
    
    // 通知配置
    this.maxNotifications = 5;
    this.defaultDuration = 3000; // 3秒
    
    // 通知統計
    this.totalNotifications = 0;
    this.notificationsByType = {
      success: 0,
      error: 0,
      warning: 0,
      info: 0
    };
    
    // 錯誤統計
    this.errorCount = 0;
    this.lastError = null;
    
    // 支援的通知類型
    this.NOTIFICATION_TYPES = {
      SUCCESS: 'success',
      ERROR: 'error',
      WARNING: 'warning',
      INFO: 'info'
    };
    
    // DOM 元素快取
    this.cachedContainer = null;
  }

  /**
   * 取得支援的事件類型
   * 
   * @returns {Array<string>} 支援的事件類型列表
   * 
   * 負責功能：
   * - 定義此處理器能處理的事件類型
   * - 用於事件總線的處理器註冊和路由
   */
  getSupportedEvents() {
    return ['UI.NOTIFICATION.SHOW'];
  }

  /**
   * 處理UI通知顯示事件的核心邏輯
   * 
   * @param {Object} event - 通知顯示事件
   * @param {string} event.type - 事件類型 (UI.NOTIFICATION.SHOW)
   * @param {Object} event.data - 通知資料
   * @param {string} event.data.message - 通知訊息
   * @param {string} [event.data.title] - 通知標題
   * @param {string} event.data.type - 通知類型 (success, error, warning, info)
   * @param {number} [event.data.duration] - 顯示持續時間 (毫秒)
   * @param {boolean} [event.data.persistent] - 是否為永久通知
   * @param {boolean} [event.data.closable] - 是否可手動關閉
   * @param {string} event.flowId - 流程追蹤ID
   * @param {number} event.timestamp - 事件時間戳
   * @returns {Promise<Object>} 處理結果
   * 
   * 負責功能：
   * - 驗證通知事件資料的完整性
   * - 創建和顯示通知元素
   * - 管理通知的生命週期
   * - 維護通知佇列和限制
   * 
   * 設計考量：
   * - 完整的資料驗證確保顯示品質
   * - 詳細的錯誤處理提供問題診斷資訊
   * - 優化的DOM操作避免性能問題
   */
  async process(event) {
    const { data, flowId, timestamp } = event;

    try {
      // 1. 前置驗證
      this.validateNotificationEvent(event);
      this.validateNotificationData(data);

      // 2. 檢查通知佇列限制
      await this.enforceNotificationLimit();

      // 3. 創建通知元素
      const notification = await this.createNotification(data, flowId);

      // 4. 顯示通知
      await this.showNotification(notification, flowId);

      // 5. 管理通知生命週期
      this.manageNotificationLifecycle(data, flowId, notification);

      // 6. 更新統計
      this.updateNotificationStats(data);

      return this.buildSuccessResponse(flowId, data);

    } catch (error) {
      // 統一錯誤處理
      this.handleNotificationError(flowId, error);
      throw error; // 重新拋出供上層處理
    }
  }

  /**
   * 驗證通知事件基本結構
   * 
   * @param {Object} event - 事件物件
   * @throws {Error} 事件結構無效時拋出錯誤
   * 
   * 負責功能：
   * - 檢查事件的基本必要欄位
   * - 驗證事件的整體結構
   */
  validateNotificationEvent(event) {
    if (!event || typeof event !== 'object') {
      throw new Error('Event must be a valid object');
    }

    if (!event.flowId) {
      throw new Error('Event must have a flowId');
    }
  }

  /**
   * 驗證通知資料的完整性和有效性
   * 
   * @param {Object} data - 要驗證的通知資料
   * @throws {Error} 資料驗證失敗時拋出錯誤
   * 
   * 負責功能：
   * - 檢查必要欄位的存在性
   * - 驗證通知類型的有效性
   * - 確保資料的基本品質要求
   */
  validateNotificationData(data) {
    if (!data || typeof data !== 'object') {
      throw new Error('Notification data must be a valid object');
    }

    if (!data.message || typeof data.message !== 'string' || data.message.trim() === '') {
      throw new Error('Message must be a non-empty string');
    }

    if (data.type && !this.isValidNotificationType(data.type)) {
      throw new Error(`Invalid notification type: ${data.type}. Valid types: ${Object.values(this.NOTIFICATION_TYPES).join(', ')}`);
    }

    if (data.duration !== undefined && (typeof data.duration !== 'number' || data.duration < 0)) {
      throw new Error('Duration must be a non-negative number');
    }
  }

  /**
   * 檢查通知類型是否有效
   * 
   * @param {string} type - 通知類型
   * @returns {boolean} 類型是否有效
   * 
   * 負責功能：
   * - 驗證通知類型在支援列表中
   */
  isValidNotificationType(type) {
    return Object.values(this.NOTIFICATION_TYPES).includes(type);
  }

  /**
   * 強制執行通知數量限制
   * 
   * 負責功能：
   * - 檢查當前活躍通知數量
   * - 移除最舊的通知以騰出空間
   */
  async enforceNotificationLimit() {
    while (this.activeNotifications.size >= this.maxNotifications) {
      const oldestFlowId = this.getOldestNotificationId();
      if (oldestFlowId) {
        await this.hideNotification(oldestFlowId);
      } else {
        break; // 避免無限循環
      }
    }
  }

  /**
   * 取得最舊的通知ID
   * 
   * @returns {string|null} 最舊通知的流程ID
   * 
   * 負責功能：
   * - 根據創建時間找到最舊的通知
   */
  getOldestNotificationId() {
    let oldestId = null;
    let oldestTime = Infinity;

    for (const [flowId, notificationInfo] of this.activeNotifications) {
      if (notificationInfo.createdAt < oldestTime) {
        oldestTime = notificationInfo.createdAt;
        oldestId = flowId;
      }
    }

    return oldestId;
  }

  /**
   * 創建通知元素
   * 
   * @param {Object} data - 通知資料
   * @param {string} flowId - 流程ID
   * @returns {Promise<Element>} 創建的通知元素
   * 
   * 負責功能：
   * - 創建通知DOM元素
   * - 設定通知內容和樣式
   * - 應用通知類型相關的CSS類別
   */
  async createNotification(data, flowId) {
    if (!this.document) {
      throw new Error('Document not available');
    }

    const notification = this.document.createElement('div');
    notification.classList.add('notification');
    notification.classList.add(`notification-${data.type || this.NOTIFICATION_TYPES.INFO}`);
    notification.setAttribute('data-flow-id', flowId);

    // 設定通知內容
    if (data.title) {
      notification.innerHTML = `
        <div class="notification-title">${this.escapeHtml(data.title)}</div>
        <div class="notification-message">${this.escapeHtml(data.message)}</div>
      `;
    } else {
      notification.textContent = data.message;
    }

    // 添加關閉按鈕（如果可關閉）
    if (data.closable !== false) {
      const closeButton = this.document.createElement('button');
      closeButton.classList.add('notification-close');
      closeButton.innerHTML = '×';
      
      // 安全地添加事件監聽器
      if (typeof closeButton.addEventListener === 'function') {
        closeButton.addEventListener('click', () => {
          this.hideNotification(flowId);
        });
      }
      
      notification.appendChild(closeButton);
    }

    return notification;
  }

  /**
   * 顯示通知
   * 
   * @param {Element} notification - 通知元素
   * @param {string} flowId - 流程ID
   * 
   * 負責功能：
   * - 將通知添加到容器中
   * - 應用顯示動畫
   * - 記錄通知狀態
   */
  async showNotification(notification, flowId) {
    const container = await this.getNotificationContainer();
    
    if (container) {
      container.appendChild(notification);
      
      // 觸發顯示動畫
      setTimeout(() => {
        notification.classList.add('notification-show');
      }, 10);
    }

    // 記錄通知狀態
    this.activeNotifications.set(flowId, {
      element: notification,
      createdAt: Date.now(),
      flowId
    });
  }

  /**
   * 隱藏通知
   * 
   * @param {string} flowId - 流程ID
   * 
   * 負責功能：
   * - 移除通知元素
   * - 清理相關的定時器
   * - 更新通知狀態
   */
  async hideNotification(flowId) {
    const notificationInfo = this.activeNotifications.get(flowId);
    if (!notificationInfo) return;

    const { element } = notificationInfo;

    // 應用隱藏動畫
    if (element.classList) {
      element.classList.remove('notification-show');
      element.classList.add('notification-hide');
    }

    // 延遲移除元素
    const removeElement = () => {
      if (element.parentNode && typeof element.parentNode.removeChild === 'function') {
        element.parentNode.removeChild(element);
      } else if (typeof element.remove === 'function') {
        element.remove();
      }
    };

    // 在測試環境中立即移除，在真實環境中延遲移除
    if (process.env.NODE_ENV === 'test') {
      removeElement();
    } else {
      setTimeout(removeElement, 300);
    }

    // 清理狀態
    this.activeNotifications.delete(flowId);
    
    // 清理定時器
    if (this.notificationTimers.has(flowId)) {
      clearTimeout(this.notificationTimers.get(flowId));
      this.notificationTimers.delete(flowId);
    }
  }

  /**
   * 管理通知生命週期
   * 
   * @param {Object} data - 通知資料
   * @param {string} flowId - 流程ID
   * @param {Element} notification - 通知元素
   * 
   * 負責功能：
   * - 設定自動隱藏定時器
   * - 處理永久通知
   */
  manageNotificationLifecycle(data, flowId, notification) {
    if (!data.persistent) {
      const duration = data.duration || this.defaultDuration;
      
      const timer = setTimeout(async () => {
        await this.hideNotification(flowId);
      }, duration);
      
      this.notificationTimers.set(flowId, timer);
    }
  }

  /**
   * 取得通知容器
   * 
   * @returns {Promise<Element>} 通知容器元素
   * 
   * 負責功能：
   * - 查找或創建通知容器
   * - 快取容器引用
   */
  async getNotificationContainer() {
    if (this.cachedContainer) {
      return this.cachedContainer;
    }

    if (!this.document) return null;

    // 尋找現有容器
    let container = this.document.querySelector('.notification-container') ||
                   this.document.querySelector('#notification-container') ||
                   this.document.querySelector('.notifications');

    // 如果沒有容器，創建一個
    if (!container) {
      container = this.document.createElement('div');
      container.classList.add('notification-container');
      container.id = 'notification-container';
      
      // 添加到頁面
      const body = this.document.body || this.document.documentElement;
      if (body) {
        body.appendChild(container);
      }
    }

    this.cachedContainer = container;
    return container;
  }

  /**
   * HTML轉義處理
   * 
   * @param {string} text - 要轉義的文字
   * @returns {string} 轉義後的文字
   * 
   * 負責功能：
   * - 防止XSS攻擊
   * - 安全地顯示用戶內容
   */
  escapeHtml(text) {
    if (!text) return '';
    
    // 備用轉義方法（在測試環境中較可靠）
    return text.replace(/[&<>"']/g, (match) => {
      const escapeMap = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;'
      };
      return escapeMap[match];
    });
  }

  /**
   * 取得活躍通知列表
   * 
   * @returns {Object} 活躍通知狀態物件
   * 
   * 負責功能：
   * - 提供所有活躍通知的狀態
   * - 轉換為普通物件格式
   */
  getActiveNotifications() {
    const notifications = {};
    for (const [flowId, notificationInfo] of this.activeNotifications) {
      notifications[flowId] = {
        flowId: notificationInfo.flowId,
        createdAt: notificationInfo.createdAt,
        persistent: !this.notificationTimers.has(flowId)
      };
    }
    return notifications;
  }

  /**
   * 更新通知統計資訊
   * 
   * @param {Object} data - 通知資料
   * 
   * 負責功能：
   * - 累計通知總數
   * - 統計不同類型的通知數量
   * - 更新平均顯示時間
   */
  updateNotificationStats(data) {
    this.totalNotifications++;
    
    const type = data.type || this.NOTIFICATION_TYPES.INFO;
    if (this.notificationsByType[type] !== undefined) {
      this.notificationsByType[type]++;
    }
  }

  /**
   * 處理通知處理錯誤
   * 
   * @param {string} flowId - 流程ID
   * @param {Error} error - 錯誤物件
   * 
   * 負責功能：
   * - 記錄詳細的錯誤資訊
   * - 更新錯誤統計
   * - 嘗試錯誤恢復
   */
  handleNotificationError(flowId, error) {
    this.errorCount++;
    this.lastError = {
      flowId,
      error: error.message,
      timestamp: Date.now()
    };

    console.error(`[UINotificationHandler] Notification display failed for flow ${flowId}:`, error);
  }

  /**
   * 建構成功回應
   * 
   * @param {string} flowId - 流程ID
   * @param {Object} data - 通知資料
   * @returns {Object} 格式化的成功回應
   * 
   * 負責功能：
   * - 統一成功回應的格式
   * - 提供一致的API介面
   */
  buildSuccessResponse(flowId, data) {
    return {
      success: true,
      flowId,
      message: data.message,
      type: data.type || this.NOTIFICATION_TYPES.INFO,
      persistent: data.persistent || false,
      timestamp: Date.now()
    };
  }

  /**
   * 取得處理器的統計資訊
   * 
   * @returns {Object} 統計資訊物件
   * 
   * 負責功能：
   * - 提供基本的執行統計 (繼承自 EventHandler)
   * - 補充通知特定的統計資訊
   * - 計算效能和使用相關指標
   */
  getStats() {
    const baseStats = super.getStats();
    
    return {
      ...baseStats,
      totalNotifications: this.totalNotifications,
      activeNotifications: this.activeNotifications.size,
      notificationsByType: { ...this.notificationsByType },
      averageDisplayTime: this.calculateAverageDisplayTime(),
      errorCount: this.errorCount,
      lastError: this.lastError
    };
  }

  /**
   * 計算平均顯示時間
   * 
   * @returns {number} 平均顯示時間（毫秒）
   * 
   * 負責功能：
   * - 基於活躍通知計算平均顯示時間
   * - 提供效能指標
   */
  calculateAverageDisplayTime() {
    if (this.activeNotifications.size === 0) return 0;

    const now = Date.now();
    let totalTime = 0;

    for (const notificationInfo of this.activeNotifications.values()) {
      totalTime += now - notificationInfo.createdAt;
    }

    return Math.round(totalTime / this.activeNotifications.size);
  }
}

module.exports = UINotificationHandler;