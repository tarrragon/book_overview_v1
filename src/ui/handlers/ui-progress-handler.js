/**
 * UI進度更新事件處理器
 * 基於 EventHandler 實現統一的進度顯示處理
 * 
 * 負責功能：
 * - 處理 UI.PROGRESS.UPDATE 事件
 * - 更新進度條和進度文字顯示
 * - 管理多個流程的進度狀態
 * - 提供進度動畫和視覺效果
 * - 自動清理完成的進度狀態
 * 
 * 設計考量：
 * - 繼承 EventHandler 提供標準化的事件處理流程
 * - 支援多流程並行進度追蹤
 * - 實現完整的錯誤處理和恢復機制
 * - 提供靈活的 DOM 元素查找和操作
 * 
 * 處理流程：
 * 1. 接收 UI.PROGRESS.UPDATE 事件
 * 2. 驗證進度資料的完整性和有效性
 * 3. 查找和更新對應的 DOM 元素
 * 4. 管理進度狀態和動畫效果
 * 5. 清理完成的進度狀態
 * 6. 更新統計資訊和效能指標
 * 
 * 使用情境：
 * - 處理資料提取進度的視覺反饋
 * - 管理多個同時進行的操作進度
 * - 提供統一的進度顯示介面
 */

const EventHandler = require('../../core/event-handler');

class UIProgressHandler extends EventHandler {
  /**
   * 建構UI進度處理器
   * 
   * @param {Object} eventBus - 事件總線實例
   * @param {Object} document - DOM文檔物件
   * 
   * 負責功能：
   * - 初始化事件處理器基本配置
   * - 設定DOM文檔和事件總線引用
   * - 配置處理器優先級 (UI更新需要較高優先級)
   * - 初始化進度狀態和動畫管理
   */
  constructor(eventBus, document) {
    super('UIProgressHandler', 2); // UI更新優先級設為2 (較高)
    
    this.eventBus = eventBus;
    this.document = document;
    
    // 進度狀態管理
    this.progressState = new Map();
    this.animationState = new Map();
    
    // UI更新統計
    this.updateCount = 0;
    this.activeFlows = new Set();
    this.completedFlows = 0;
    this.lastUpdateTime = null;
    
    // 錯誤統計
    this.errorCount = 0;
    this.lastError = null;
    
    // DOM元素快取
    this.cachedElements = new Map();
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
    return ['UI.PROGRESS.UPDATE'];
  }

  /**
   * 處理UI進度更新事件的核心邏輯
   * 
   * @param {Object} event - 進度更新事件
   * @param {string} event.type - 事件類型 (UI.PROGRESS.UPDATE)
   * @param {Object} event.data - 進度資料
   * @param {number} event.data.percentage - 進度百分比 (0-100)
   * @param {string} event.data.message - 進度訊息
   * @param {string} [event.data.status] - 進度狀態 (started, progress, completed, error)
   * @param {boolean} [event.data.animated] - 是否啟用動畫
   * @param {string} event.flowId - 流程追蹤ID
   * @param {number} event.timestamp - 事件時間戳
   * @returns {Promise<Object>} 處理結果
   * 
   * 負責功能：
   * - 驗證進度事件資料的完整性
   * - 更新對應的DOM進度元素
   * - 管理進度狀態和視覺效果
   * - 處理多流程的進度追蹤
   * 
   * 設計考量：
   * - 完整的資料驗證確保顯示品質
   * - 詳細的錯誤處理提供問題診斷資訊
   * - 效能優化的DOM操作避免頻繁重繪
   */
  async process(event) {
    const { data, flowId, timestamp } = event;

    try {
      // 1. 前置驗證
      this.validateProgressEvent(event);
      this.validateProgressData(data);

      // 2. 更新進度狀態
      this.updateProgressState(flowId, data, timestamp);

      // 3. 更新DOM元素
      await this.updateProgressDisplay(data, flowId);

      // 4. 處理狀態變化
      await this.handleProgressStatus(data, flowId);

      // 5. 更新統計
      this.updateProgressStats(flowId, data);

      // 6. 清理完成的流程
      if (data.status === 'completed') {
        this.scheduleProgressCleanup(flowId);
      }

      return this.buildSuccessResponse(flowId, data);

    } catch (error) {
      // 統一錯誤處理
      this.handleProgressError(flowId, error);
      throw error; // 重新拋出供上層處理
    }
  }

  /**
   * 驗證進度事件基本結構
   * 
   * @param {Object} event - 事件物件
   * @throws {Error} 事件結構無效時拋出錯誤
   * 
   * 負責功能：
   * - 檢查事件的基本必要欄位
   * - 驗證事件的整體結構
   */
  validateProgressEvent(event) {
    if (!event || typeof event !== 'object') {
      throw new Error('Event must be a valid object');
    }

    if (!event.flowId) {
      throw new Error('Event must have a flowId');
    }
  }

  /**
   * 驗證進度資料的完整性和有效性
   * 
   * @param {Object} data - 要驗證的進度資料
   * @throws {Error} 資料驗證失敗時拋出錯誤
   * 
   * 負責功能：
   * - 檢查必要欄位的存在性
   * - 驗證進度百分比的範圍
   * - 確保資料的基本品質要求
   */
  validateProgressData(data) {
    if (!data || typeof data !== 'object') {
      throw new Error('Progress data must be a valid object');
    }

    if (typeof data.percentage !== 'number') {
      throw new Error('Percentage must be a number');
    }

    if (data.percentage < 0 || data.percentage > 100) {
      throw new Error('Percentage must be between 0 and 100');
    }

    if (!data.message || typeof data.message !== 'string') {
      throw new Error('Message must be a non-empty string');
    }
  }

  /**
   * 更新進度狀態
   * 
   * @param {string} flowId - 流程ID
   * @param {Object} data - 進度資料
   * @param {number} timestamp - 時間戳
   * 
   * 負責功能：
   * - 記錄流程的進度狀態
   * - 維護流程的歷史記錄
   * - 管理活躍流程集合
   */
  updateProgressState(flowId, data, timestamp) {
    const progressInfo = {
      percentage: data.percentage,
      message: data.message,
      status: data.status || 'progress',
      animated: data.animated || false,
      updatedAt: timestamp || Date.now(),
      startedAt: this.progressState.has(flowId) 
        ? this.progressState.get(flowId).startedAt 
        : Date.now()
    };

    this.progressState.set(flowId, progressInfo);
    this.activeFlows.add(flowId);
  }

  /**
   * 更新進度顯示元素
   * 
   * @param {Object} data - 進度資料
   * @param {string} flowId - 流程ID
   * 
   * 負責功能：
   * - 查找並更新進度條元素
   * - 設定進度文字內容
   * - 管理進度元素的可見性
   */
  async updateProgressDisplay(data, flowId) {
    try {
      const progressElement = this.getProgressElement();
      if (!progressElement) {
        return; // 如果沒有進度元素，靜默處理
      }

      const progressBar = this.getProgressBar();
      const progressText = this.getProgressText();

      // 更新進度條
      if (progressBar) {
        progressBar.style.width = `${data.percentage}%`;
        progressBar.setAttribute('aria-valuenow', data.percentage.toString());
        
        if (data.animated) {
          progressBar.classList.add('progress-animated');
        }
      }

      // 更新進度文字
      if (progressText) {
        progressText.textContent = data.message;
      }

      // 顯示進度元素
      await this.showProgress();

    } catch (error) {
      // DOM操作錯誤不應該阻止整個處理流程
      console.warn('[UIProgressHandler] DOM update failed:', error.message);
    }
  }

  /**
   * 處理進度狀態變化
   * 
   * @param {Object} data - 進度資料
   * @param {string} flowId - 流程ID
   * 
   * 負責功能：
   * - 處理不同的進度狀態
   * - 應用對應的視覺效果
   * - 觸發狀態變化事件
   */
  async handleProgressStatus(data, flowId) {
    const progressElement = this.getProgressElement();
    if (!progressElement) return;

    switch (data.status) {
      case 'started':
        progressElement.classList.add('progress-active');
        break;
      case 'completed':
        progressElement.classList.add('progress-completed');
        break;
      case 'error':
        progressElement.classList.add('progress-error');
        break;
    }
  }

  /**
   * 顯示進度元素
   * 
   * 負責功能：
   * - 設定進度元素為可見
   * - 添加相應的CSS類別
   */
  async showProgress() {
    const progressElement = this.getProgressElement();
    if (progressElement) {
      progressElement.style.display = 'block';
      progressElement.classList.add('progress-visible');
    }
  }

  /**
   * 隱藏進度元素
   * 
   * 負責功能：
   * - 設定進度元素為隱藏
   * - 移除相應的CSS類別
   */
  async hideProgress() {
    const progressElement = this.getProgressElement();
    if (progressElement) {
      progressElement.style.display = 'none';
      progressElement.classList.remove('progress-visible');
    }
  }

  /**
   * 取得進度容器元素
   * 
   * @returns {Element|null} 進度容器元素
   * 
   * 負責功能：
   * - 查找主要的進度顯示元素
   * - 提供元素快取機制
   */
  getProgressElement() {
    if (!this.document) return null;

    if (!this.cachedElements.has('progress')) {
      const element = this.document.querySelector('.progress-container') ||
                     this.document.querySelector('#progress-container') ||
                     this.document.querySelector('.progress');
      this.cachedElements.set('progress', element);
    }

    return this.cachedElements.get('progress');
  }

  /**
   * 取得進度條元素
   * 
   * @returns {Element|null} 進度條元素
   * 
   * 負責功能：
   * - 查找進度條顯示元素
   * - 支援多種CSS選擇器
   */
  getProgressBar() {
    const progressElement = this.getProgressElement();
    if (!progressElement) return null;

    return progressElement.querySelector('.progress-bar') ||
           progressElement.querySelector('.bar') ||
           progressElement.querySelector('[role="progressbar"]');
  }

  /**
   * 取得進度文字元素
   * 
   * @returns {Element|null} 進度文字元素
   * 
   * 負責功能：
   * - 查找進度文字顯示元素
   * - 支援多種CSS選擇器
   */
  getProgressText() {
    const progressElement = this.getProgressElement();
    if (!progressElement) return null;

    return progressElement.querySelector('.progress-text') ||
           progressElement.querySelector('.text') ||
           progressElement.querySelector('.message');
  }

  /**
   * 取得當前進度狀態
   * 
   * @returns {Object} 進度狀態物件
   * 
   * 負責功能：
   * - 提供所有流程的進度狀態
   * - 轉換為普通物件格式
   */
  getProgressState() {
    const state = {};
    for (const [flowId, progressInfo] of this.progressState) {
      state[flowId] = { ...progressInfo };
    }
    return state;
  }

  /**
   * 更新進度統計資訊
   * 
   * @param {string} flowId - 流程ID
   * @param {Object} data - 進度資料
   * 
   * 負責功能：
   * - 累計更新次數
   * - 記錄最後更新時間
   * - 統計活躍流程數量
   */
  updateProgressStats(flowId, data) {
    this.updateCount++;
    this.lastUpdateTime = Date.now();

    if (data.status === 'completed') {
      this.completedFlows++;
      this.activeFlows.delete(flowId);
    }
  }

  /**
   * 安排進度狀態清理
   * 
   * @param {string} flowId - 流程ID
   * 
   * 負責功能：
   * - 延遲清理完成的進度狀態
   * - 避免立即清理影響視覺效果
   */
  scheduleProgressCleanup(flowId) {
    setTimeout(() => {
      this.progressState.delete(flowId);
      this.animationState.delete(flowId);
      this.activeFlows.delete(flowId);
    }, 3000); // 3秒後清理
  }

  /**
   * 處理進度處理錯誤
   * 
   * @param {string} flowId - 流程ID
   * @param {Error} error - 錯誤物件
   * 
   * 負責功能：
   * - 記錄詳細的錯誤資訊
   * - 更新錯誤統計
   * - 嘗試錯誤恢復
   */
  handleProgressError(flowId, error) {
    this.errorCount++;
    this.lastError = {
      flowId,
      error: error.message,
      timestamp: Date.now()
    };

    console.error(`[UIProgressHandler] Progress update failed for flow ${flowId}:`, error);
  }

  /**
   * 建構成功回應
   * 
   * @param {string} flowId - 流程ID
   * @param {Object} data - 進度資料
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
      percentage: data.percentage,
      message: data.message,
      status: data.status || 'progress',
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
   * - 補充UI進度特定的統計資訊
   * - 計算效能和狀態相關指標
   */
  getStats() {
    const baseStats = super.getStats();
    
    return {
      ...baseStats,
      updateCount: this.updateCount,
      activeFlows: this.activeFlows.size,
      completedFlows: this.completedFlows,
      lastUpdateTime: this.lastUpdateTime,
      errorCount: this.errorCount,
      lastError: this.lastError
    };
  }
}

module.exports = UIProgressHandler;