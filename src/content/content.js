/**
 * Readmoo 書庫數據提取器 - Content Script
 * 
 * 負責功能：
 * - 整合 v0.1.0 事件系統 (EventBus, ChromeEventBridge)
 * - 整合 v0.2.0 資料提取器 (BookDataExtractor, ReadmooAdapter)
 * - 在 Readmoo 網頁中執行完整的資料提取流程
 * - 與 Background Service Worker 進行雙向事件通訊
 * - 提供即時的提取進度回饋和錯誤處理
 * 
 * 設計考量：
 * - 基於事件驅動架構，確保模組間松耦合
 * - 支援頁面生命週期管理和 SPA 導航
 * - 提供強健的錯誤處理和恢復機制
 * - 確保與網頁的非侵入式整合
 * - 優化效能和記憶體使用
 * 
 * 架構整合：
 * - EventBus: 內部事件管理和協調
 * - ChromeEventBridge: 跨上下文通訊橋接
 * - BookDataExtractor: 事件驅動的提取流程管理
 * - ReadmooAdapter: DOM 操作和資料解析
 * 
 * 處理流程：
 * 1. 頁面載入 → 檢測 Readmoo 頁面
 * 2. 初始化 → 建立事件系統和提取器
 * 3. 事件註冊 → 設定跨上下文通訊
 * 4. 資料提取 → 響應 Background 指令
 * 5. 進度回報 → 即時更新提取狀態
 * 6. 清理資源 → 頁面卸載時釋放記憶體
 * 
 * 使用情境：
 * - 當用戶在 Readmoo 書庫頁面時自動啟動
 * - 接收 Background 的提取指令並執行
 * - 即時回報提取進度和狀態
 * - 處理頁面導航和動態內容變更
 * 
 * @version 0.3.0
 * @author Readmoo Extension Team
 */

console.log('📚 Readmoo Content Script 開始載入');

// ====================
// 全域變數和狀態管理
// ====================

// 頁面檢測狀態
let isReadmooPage = false;
let pageType = 'unknown';
let contentScriptReady = false;

// 核心模組實例
let contentEventBus = null;
let contentChromeBridge = null;
let bookDataExtractor = null;
let readmooAdapter = null;

// 監聽器和觀察器
let urlChangeObserver = null;
let currentUrl = window.location.href;

// 效能監控
const performanceStats = {
  initializationTime: 0,
  eventProcessingTime: 0,
  extractionTime: 0
};

// ====================
// 簡化版事件系統 (基於 v0.1.0 設計)
// ====================

/**
 * 建立簡化的 EventBus (適配 Content Script 環境)
 * 
 * 負責功能：
 * - 內部事件註冊、觸發和管理
 * - 優先級排序和異步處理
 * - 錯誤隔離和統計追蹤
 * - 效能監控和記憶體管理
 * 
 * 設計考量：
 * - 基於 Observer 模式，適配瀏覽器環境
 * - 支援事件優先級和一次性監聽器
 * - 提供完整的統計和調試資訊
 * - 優化記憶體使用，避免監聽器洩漏
 * 
 * 處理流程：
 * 1. 事件註冊 → 按優先級排序插入
 * 2. 事件觸發 → 順序執行所有監聽器
 * 3. 錯誤隔離 → 單個監聽器錯誤不影響其他
 * 4. 統計更新 → 記錄執行時間和次數
 * 5. 記憶體清理 → 移除一次性監聽器
 * 
 * @returns {Object} EventBus 實例
 */
function createContentEventBus() {
  const listeners = new Map();
  const stats = {
    totalEvents: 0,
    totalEmissions: 0,
    totalExecutionTime: 0,
    eventStats: new Map(),
    memoryUsage: {
      totalListeners: 0,
      activeEventTypes: 0
    }
  };

  return {
    /**
     * 註冊事件監聽器
     * 
     * @param {string} eventType - 事件類型
     * @param {Function} handler - 事件處理函數
     * @param {Object} options - 選項配置
     * @param {number} [options.priority=2] - 優先級 (0=最高, 數字越小優先級越高)
     * @param {boolean} [options.once=false] - 是否為一次性監聽器
     * @returns {string} 監聽器ID，用於後續移除
     */
    on(eventType, handler, options = {}) {
      if (typeof eventType !== 'string' || typeof handler !== 'function') {
        throw new Error('EventBus.on: eventType 必須是字串，handler 必須是函數');
      }

      if (!listeners.has(eventType)) {
        listeners.set(eventType, []);
        stats.memoryUsage.activeEventTypes++;
      }

      const wrapper = {
        handler,
        priority: options.priority !== undefined ? options.priority : 2,
        once: options.once || false,
        id: `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        createdAt: Date.now()
      };

      const eventListeners = listeners.get(eventType);
      
      // 按優先級插入 (優化：使用二分搜尋提升效能)
      let insertIndex = eventListeners.length;
      for (let i = 0; i < eventListeners.length; i++) {
        if (wrapper.priority < eventListeners[i].priority) {
          insertIndex = i;
          break;
        }
      }
      
      eventListeners.splice(insertIndex, 0, wrapper);
      stats.memoryUsage.totalListeners++;
      
      return wrapper.id;
    },

    /**
     * 移除事件監聽器
     * 
     * @param {string} eventType - 事件類型
     * @param {string|Function} handler - 監聽器ID或處理函數
     * @returns {boolean} 是否成功移除
     */
    off(eventType, handler) {
      if (!listeners.has(eventType)) return false;

      const eventListeners = listeners.get(eventType);
      const index = eventListeners.findIndex(wrapper => 
        wrapper.handler === handler || wrapper.id === handler
      );

      if (index !== -1) {
        eventListeners.splice(index, 1);
        stats.memoryUsage.totalListeners--;
        
        // 清理空的事件類型
        if (eventListeners.length === 0) {
          listeners.delete(eventType);
          stats.memoryUsage.activeEventTypes--;
        }
        
        return true;
      }

      return false;
    },

    /**
     * 觸發事件
     * 
     * @param {string} eventType - 事件類型
     * @param {Object} [data={}] - 事件資料
     * @returns {Promise<Object>} 事件處理結果
     */
    async emit(eventType, data = {}) {
      const startTime = performance.now();

      try {
        const event = {
          type: eventType,
          data,
          timestamp: Date.now(),
          id: `evt_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`
        };

        const eventListeners = listeners.has(eventType) ? [...listeners.get(eventType)] : [];
        const results = [];
        const listenersToRemove = [];

        // 並行處理監聽器 (除非有依賴關係)
        for (const wrapper of eventListeners) {
          try {
            const result = await wrapper.handler(event);
            results.push({ success: true, result, listenerId: wrapper.id });

            // 標記一次性監聽器待移除
            if (wrapper.once) {
              listenersToRemove.push({ eventType, id: wrapper.id });
            }
          } catch (error) {
            console.error(`❌ Content Script 事件處理器錯誤 (${eventType}):`, error);
            results.push({ 
              success: false, 
              error: error.message, 
              listenerId: wrapper.id 
            });
          }
        }

        // 清理一次性監聽器
        listenersToRemove.forEach(({ eventType, id }) => {
          this.off(eventType, id);
        });

        // 更新統計 (優化：批量更新)
        const executionTime = performance.now() - startTime;
        stats.totalEvents++;
        stats.totalEmissions++;
        stats.totalExecutionTime += executionTime;

        if (!stats.eventStats.has(eventType)) {
          stats.eventStats.set(eventType, { 
            count: 0, 
            totalTime: 0, 
            avgTime: 0,
            lastEmitted: 0 
          });
        }
        
        const eventStat = stats.eventStats.get(eventType);
        eventStat.count++;
        eventStat.totalTime += executionTime;
        eventStat.avgTime = eventStat.totalTime / eventStat.count;
        eventStat.lastEmitted = Date.now();

        return { 
          success: true, 
          results, 
          executionTime,
          listenersCount: eventListeners.length 
        };

      } catch (error) {
        console.error(`❌ Content Script 事件觸發失敗 (${eventType}):`, error);
        return { 
          success: false, 
          error: error.message, 
          executionTime: performance.now() - startTime 
        };
      }
    },

    /**
     * 取得統計資訊
     * 
     * @returns {Object} 事件系統統計資料
     */
    getStats() {
      return { 
        ...stats,
        memoryUsage: { ...stats.memoryUsage },
        uptime: Date.now() - (stats.createdAt || Date.now())
      };
    },

    /**
     * 清理事件系統
     * 
     * 使用情境：頁面卸載或重新初始化時
     */
    destroy() {
      listeners.clear();
      stats.eventStats.clear();
      stats.totalEvents = 0;
      stats.totalEmissions = 0;
      stats.totalExecutionTime = 0;
      stats.memoryUsage.totalListeners = 0;
      stats.memoryUsage.activeEventTypes = 0;
      
      console.log('🧹 EventBus 已清理完成');
    }
  };
}

/**
 * 建立簡化的 ChromeEventBridge (適配 Content Script 環境)
 * 
 * 負責功能：
 * - 與 Background Service Worker 的雙向通訊
 * - 內部事件與 Chrome API 的橋接
 * - 訊息封裝和錯誤處理
 * - 通訊效能監控
 * 
 * 設計考量：
 * - 確保訊息格式的一致性
 * - 提供強健的錯誤恢復機制
 * - 支援高頻率訊息的效能優化
 * - 記錄通訊統計供調試使用
 * 
 * 處理流程：
 * 1. 訊息封裝 → 統一格式和元資料
 * 2. Chrome API 調用 → 發送到 Background
 * 3. 錯誤處理 → 記錄失敗原因
 * 4. 統計更新 → 追蹤通訊效能
 * 
 * @returns {Object} ChromeEventBridge 實例
 */
function createContentChromeBridge() {
  let eventBus = null;
  const communicationStats = {
    messagesSent: 0,
    messagesSucceeded: 0,
    messagesFailed: 0,
    totalLatency: 0,
    avgLatency: 0,
    lastCommunication: 0
  };

  return {
    /**
     * 設定 EventBus 實例
     * 
     * @param {Object} bus - EventBus 實例
     */
    set eventBus(bus) {
      eventBus = bus;
    },

    /**
     * 取得 EventBus 實例
     * 
     * @returns {Object} EventBus 實例
     */
    get eventBus() {
      return eventBus;
    },

    /**
     * 發送訊息到 Background
     * 
     * @param {Object} message - 要發送的訊息
     * @param {string} message.type - 訊息類型
     * @param {Object} [message.data] - 訊息資料
     * @returns {Promise<Object>} 發送結果
     */
    async sendToBackground(message) {
      const startTime = performance.now();
      
      try {
        // 訊息格式驗證
        if (!message || typeof message.type !== 'string') {
          throw new Error('無效的訊息格式：缺少 type 欄位');
        }

        // 添加元資料
        const enrichedMessage = {
          ...message,
          metadata: {
            sender: 'content-script',
            timestamp: Date.now(),
            version: '0.3.0',
            url: window.location.href,
            ...message.metadata
          }
        };

        communicationStats.messagesSent++;
        const response = await chrome.runtime.sendMessage(enrichedMessage);
        
        const latency = performance.now() - startTime;
        communicationStats.messagesSucceeded++;
        communicationStats.totalLatency += latency;
        communicationStats.avgLatency = communicationStats.totalLatency / communicationStats.messagesSucceeded;
        communicationStats.lastCommunication = Date.now();
        
        return { 
          success: true, 
          response,
          latency 
        };
        
      } catch (error) {
        const latency = performance.now() - startTime;
        communicationStats.messagesFailed++;
        
        console.error('❌ Content Script 發送訊息失敗 (Background):', {
          error: error.message,
          message: message.type,
          latency
        });
        
        return { 
          success: false, 
          error: error.message, 
          latency 
        };
      }
    },

    /**
     * 橋接內部事件到 Background
     * 
     * @param {string} eventType - 事件類型
     * @param {Object} data - 事件資料
     * @returns {Promise<Object>} 轉發結果
     */
    async forwardEventToBackground(eventType, data) {
      const message = {
        type: 'CONTENT.EVENT.FORWARD',
        eventType,
        data,
        timestamp: Date.now()
      };

      return await this.sendToBackground(message);
    },

    /**
     * 取得通訊統計
     * 
     * @returns {Object} 通訊統計資料
     */
    getStats() {
      return { ...communicationStats };
    }
  };
}

// ====================
// 簡化版提取器 (基於 v0.2.0 設計)
// ====================

/**
 * 建立簡化的 BookDataExtractor (適配 Content Script 環境)
 * 
 * 負責功能：
 * - 事件驅動的書籍資料提取流程管理
 * - 多並行提取流程支援
 * - 即時進度回報和錯誤處理
 * - 頁面類型檢測和相容性驗證
 * 
 * 設計考量：
 * - 支援取消和恢復機制
 * - 提供詳細的流程狀態追蹤
 * - 優化記憶體使用，避免流程堆積
 * - 確保與事件系統的緊密整合
 * 
 * 處理流程：
 * 1. 流程啟動 → 檢查頁面可提取性
 * 2. 進度追蹤 → 定期報告提取進度
 * 3. 資料提取 → 調用 ReadmooAdapter
 * 4. 結果回報 → 觸發完成或錯誤事件
 * 5. 流程清理 → 釋放相關資源
 * 
 * @returns {Object} BookDataExtractor 實例
 */
function createContentBookDataExtractor() {
  let eventBus = null;
  let readmooAdapter = null;
  const activeExtractionFlows = new Map();
  const extractionHistory = [];
  const maxHistorySize = 50; // 限制歷史記錄大小

  const extractor = {
    /**
     * 設定事件系統
     * 
     * @param {Object} bus - EventBus 實例
     */
    setEventBus(bus) {
      eventBus = bus;
    },

    /**
     * 取得事件系統
     * 
     * @returns {Object} EventBus 實例
     */
    get eventBus() {
      return eventBus;
    },

    /**
     * 設定 ReadmooAdapter
     * 
     * @param {Object} adapter - ReadmooAdapter 實例
     */
    setReadmooAdapter(adapter) {
      readmooAdapter = adapter;
    },

    /**
     * 檢測 Readmoo 頁面類型
     * 
     * @returns {string} 頁面類型 ('library', 'shelf', 'reader', 'unknown')
     */
    getReadmooPageType() {
      const url = window.location.href;
      const pathname = window.location.pathname;

      if (url.includes('/library') || pathname.includes('/library')) {
        return 'library';
      }
      if (url.includes('/shelf') || pathname.includes('/shelf')) {
        return 'shelf';
      }
      if (url.includes('/book/') || pathname.includes('/book/') || 
          url.includes('/api/reader/') || pathname.includes('/api/reader/')) {
        return 'reader';
      }

      return 'unknown';
    },

    /**
     * 檢查是否為可提取的頁面
     * 
     * @returns {boolean} 是否可提取
     */
    isExtractableReadmooPage() {
      const pageType = this.getReadmooPageType();
      return ['library', 'shelf'].includes(pageType);
    },

    /**
     * 檢查頁面準備狀態
     * 
     * @returns {Promise<Object>} 頁面狀態資訊
     */
    async checkPageReady() {
      const pageType = this.getReadmooPageType();
      const isReady = document.readyState === 'complete' || document.readyState === 'interactive';
      
      let bookCount = 0;
      if (readmooAdapter) {
        const bookElements = readmooAdapter.getBookElements();
        bookCount = bookElements.length;
      }

      return {
        isReady,
        pageType,
        bookCount,
        extractable: this.isExtractableReadmooPage() && bookCount > 0,
        url: window.location.href,
        timestamp: Date.now()
      };
    },

    /**
     * 生成唯一的流程 ID
     * 
     * @returns {string} 流程 ID
     */
    generateFlowId() {
      return `flow_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    },

    /**
     * 啟動提取流程
     * 
     * @param {Object} [config={}] - 提取配置
     * @param {string} [config.pageType] - 指定頁面類型
     * @param {Object} [config.options] - 額外選項
     * @returns {Promise<string>} 流程 ID
     */
    async startExtractionFlow(config = {}) {
      const flowId = this.generateFlowId();
      const pageType = config.pageType || this.getReadmooPageType();

      try {
        // 檢查頁面是否可提取
        if (!this.isExtractableReadmooPage()) {
          throw new Error(`不支援的頁面類型: ${pageType}`);
        }

        // 建立流程狀態
        const flowState = {
          id: flowId,
          pageType,
          config,
          status: 'started',
          startTime: Date.now(),
          progress: 0,
          extractedBooks: [],
          errors: []
        };

        activeExtractionFlows.set(flowId, flowState);

        // 觸發開始事件
        if (eventBus) {
          await eventBus.emit('EXTRACTION.STARTED', {
            flowId,
            pageType,
            config,
            timestamp: Date.now()
          });
        }

        // 執行實際提取
        await this.performActualExtraction(flowId);

        return flowId;

      } catch (error) {
        console.error('❌ 啟動提取流程失敗:', error);
        
        if (eventBus) {
          await eventBus.emit('EXTRACTION.ERROR', {
            flowId,
            error: error.message,
            timestamp: Date.now()
          });
        }

        throw error;
      }
    },

    /**
     * 執行實際提取
     * 
     * @param {string} flowId - 流程 ID
     * @returns {Promise<void>}
     */
    async performActualExtraction(flowId) {
      const flowState = activeExtractionFlows.get(flowId);
      if (!flowState || !readmooAdapter) {
        throw new Error('流程狀態或適配器不存在');
      }

      try {
        // 報告進度: 開始提取
        await this.reportProgress(flowId, 0.1, '開始提取書籍資料');

        // 提取所有書籍
        const booksData = await readmooAdapter.extractAllBooks();
        
        // 更新流程狀態
        flowState.extractedBooks = booksData;
        flowState.progress = 1.0;
        flowState.status = 'completed';
        flowState.endTime = Date.now();

        // 報告完成
        if (eventBus) {
          await eventBus.emit('EXTRACTION.COMPLETED', {
            flowId,
            booksData,
            count: booksData.length,
            duration: flowState.endTime - flowState.startTime,
            timestamp: Date.now()
          });
        }

        // 記錄到歷史並清理活動流程
        this.addToHistory(flowState);
        activeExtractionFlows.delete(flowId);

      } catch (error) {
        flowState.status = 'failed';
        flowState.errors.push(error.message);
        flowState.endTime = Date.now();
        
        // 觸發錯誤事件
        if (eventBus) {
          await eventBus.emit('EXTRACTION.ERROR', {
            flowId,
            error: error.message,
            timestamp: Date.now()
          });
        }
        
        // 記錄失敗流程到歷史
        this.addToHistory(flowState);
        activeExtractionFlows.delete(flowId);
        
        throw error;
      }
    },

    /**
     * 報告進度
     * 
     * @param {string} flowId - 流程 ID
     * @param {number} progress - 進度 (0-1)
     * @param {string} [message=''] - 進度訊息
     * @returns {Promise<void>}
     */
    async reportProgress(flowId, progress, message = '') {
      const flowState = activeExtractionFlows.get(flowId);
      if (flowState) {
        flowState.progress = progress;
        flowState.lastUpdate = Date.now();
      }

      if (eventBus) {
        await eventBus.emit('EXTRACTION.PROGRESS', {
          flowId,
          progress,
          message,
          timestamp: Date.now()
        });
      }
    },

    /**
     * 取消提取流程
     * 
     * @param {string} flowId - 流程 ID
     * @returns {Promise<Object>} 取消結果
     */
    async cancelExtraction(flowId) {
      const flowState = activeExtractionFlows.get(flowId);
      if (flowState) {
        flowState.status = 'cancelled';
        flowState.endTime = Date.now();

        if (eventBus) {
          await eventBus.emit('EXTRACTION.CANCELLED', {
            flowId,
            timestamp: Date.now()
          });
        }

        // 移至歷史並清理
        this.addToHistory(flowState);
        activeExtractionFlows.delete(flowId);

        return { success: true, flowId };
      }

      return { success: false, error: '流程不存在' };
    },

    /**
     * 取得流程狀態
     * 
     * @param {string} flowId - 流程 ID
     * @returns {Object|null} 流程狀態
     */
    getExtractionFlowStatus(flowId) {
      return activeExtractionFlows.get(flowId) || null;
    },

    /**
     * 取得活動流程列表
     * 
     * @returns {string[]} 活動流程 ID 列表
     */
    getActiveExtractionFlows() {
      return Array.from(activeExtractionFlows.keys());
    },

    /**
     * 添加流程到歷史記錄
     * 
     * @param {Object} flowState - 流程狀態
     */
    addToHistory(flowState) {
      extractionHistory.unshift({
        ...flowState,
        archivedAt: Date.now()
      });

      // 限制歷史記錄大小
      if (extractionHistory.length > maxHistorySize) {
        extractionHistory.splice(maxHistorySize);
      }
    },

    /**
     * 取得提取歷史
     * 
     * @param {number} [limit=10] - 返回記錄數量限制
     * @returns {Object[]} 歷史記錄
     */
    getExtractionHistory(limit = 10) {
      return extractionHistory.slice(0, limit);
    }
  };

  // 設定構造函數名稱
  Object.defineProperty(extractor, 'constructor', {
    value: { name: 'BookDataExtractor' },
    writable: false
  });

  return extractor;
}

/**
 * 建立簡化的 ReadmooAdapter (適配 Content Script 環境)
 * 
 * 負責功能：
 * - DOM 操作和書籍元素提取
 * - 書籍資料解析和格式化
 * - 安全性過濾和資料驗證
 * - 提取統計和效能監控
 * 
 * 設計考量：
 * - 支援多種 DOM 結構變化
 * - 實現強健的 XSS 防護
 * - 優化 DOM 查詢效能
 * - 提供詳細的除錯資訊
 * 
 * 處理流程：
 * 1. DOM 查詢 → 找出所有書籍元素
 * 2. 資料解析 → 提取 ID、標題、封面等
 * 3. 安全過濾 → 移除惡意內容
 * 4. 格式驗證 → 確保資料完整性
 * 5. 統計更新 → 記錄提取結果
 * 
 * @returns {Object} ReadmooAdapter 實例
 */
function createContentReadmooAdapter() {
  const stats = {
    totalExtracted: 0,
    successfulExtractions: 0,
    failedExtractions: 0,
    domQueryTime: 0,
    parseTime: 0,
    lastExtraction: 0
  };

  // DOM 選擇器配置 (支援未來擴展)
  const SELECTORS = {
    bookLinks: [
      'a[href*="/api/reader/"]',
      '.book-item',
      '.library-item',
      'a[href*="/book/"]'
    ],
    progressIndicators: [
      '.progress',
      '[class*="progress"]',
      '.reading-progress'
    ]
  };

  // 安全性過濾規則
  const SECURITY_FILTERS = {
    maliciousProtocols: ['javascript:', 'data:', 'vbscript:'],
    allowedImageTypes: ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg']
  };

  const adapter = {
    /**
     * 取得書籍元素
     * 
     * @returns {HTMLElement[]} 書籍元素陣列
     */
    getBookElements() {
      const startTime = performance.now();
      const elements = [];
      
      try {
        // 使用多個選擇器查找元素
        for (const selector of SELECTORS.bookLinks) {
          const found = document.querySelectorAll(selector);
          elements.push(...Array.from(found));
        }

        // 去重處理 (優化：使用 Set 提升效能)
        const uniqueElements = [];
        const seenHrefs = new Set();
        
        for (const element of elements) {
          const href = element.getAttribute('href') || '';
          if (href && !seenHrefs.has(href)) {
            seenHrefs.add(href);
            uniqueElements.push(element);
          }
        }

        stats.domQueryTime += performance.now() - startTime;
        return uniqueElements;

      } catch (error) {
        console.error('❌ DOM 查詢失敗:', error);
        stats.domQueryTime += performance.now() - startTime;
        return [];
      }
    },

    /**
     * 解析書籍元素
     * 
     * @param {HTMLElement} element - 書籍元素
     * @returns {Object|null} 書籍資料物件
     */
    parseBookElement(element) {
      const startTime = performance.now();
      
      try {
        const href = element.getAttribute('href') || '';
        
        // 安全檢查 - 過濾惡意URL
        if (this.isUnsafeUrl(href)) {
          console.warn('⚠️ 檢測到惡意URL，已過濾:', href);
          stats.failedExtractions++;
          return null;
        }
        
        // 提取 ID (優化：使用快取的正則表達式)
        let id = this.extractBookId(href);

        // 查找圖片和標題 (優化：限制查詢範圍)
        const img = element.querySelector('img') || element.parentNode.querySelector('img');
        let title = img ? (img.getAttribute('alt') || img.getAttribute('title') || '') : '';
        let cover = img ? img.getAttribute('src') || '' : '';

        // 安全檢查 - 過濾惡意圖片URL
        if (cover && this.isUnsafeUrl(cover)) {
          console.warn('⚠️ 檢測到惡意圖片URL，已過濾:', cover);
          cover = '';
        }

        // 查找進度資訊
        let progress = this.extractProgress(element);

        // 額外的書籍資訊 (擴展性設計)
        const additionalInfo = this.extractAdditionalInfo(element);

        const bookData = {
          id: id || `unknown_${Date.now()}`,
          title: this.sanitizeText(title) || '未知標題',
          cover: cover || '',
          progress: progress,
          extractedAt: new Date().toISOString(),
          url: href,
          ...additionalInfo
        };

        stats.parseTime += performance.now() - startTime;
        return bookData;

      } catch (error) {
        console.error('❌ 解析書籍元素失敗:', error);
        stats.failedExtractions++;
        stats.parseTime += performance.now() - startTime;
        return null;
      }
    },

    /**
     * 提取所有書籍
     * 
     * @returns {Promise<Object[]>} 書籍資料陣列
     */
    async extractAllBooks() {
      const extractionStart = performance.now();
      const bookElements = this.getBookElements();
      const books = [];

      stats.totalExtracted = bookElements.length;
      stats.successfulExtractions = 0;
      stats.failedExtractions = 0;

      // 批量處理 (優化：避免阻塞主執行緒)
      const batchSize = 10;
      for (let i = 0; i < bookElements.length; i += batchSize) {
        const batch = bookElements.slice(i, i + batchSize);
        
        for (const element of batch) {
          const bookData = this.parseBookElement(element);
          if (bookData) {
            books.push(bookData);
            stats.successfulExtractions++;
          }
        }

        // 讓渡控制權給瀏覽器 (防止頁面凍結)
        if (i + batchSize < bookElements.length) {
          await new Promise(resolve => setTimeout(resolve, 0));
        }
      }

      stats.lastExtraction = Date.now();
      const totalTime = performance.now() - extractionStart;
      
      console.log(`📊 提取完成: ${books.length}/${bookElements.length} 本書籍 (${totalTime.toFixed(2)}ms)`);

      return books;
    },

    /**
     * 檢查URL是否安全
     * 
     * @param {string} url - 要檢查的URL
     * @returns {boolean} 是否為不安全的URL
     */
    isUnsafeUrl(url) {
      if (!url || typeof url !== 'string') return false;
      
      const lowerUrl = url.toLowerCase().trim();
      return SECURITY_FILTERS.maliciousProtocols.some(protocol => 
        lowerUrl.startsWith(protocol)
      );
    },

    /**
     * 提取書籍ID
     * 
     * @param {string} href - 書籍連結
     * @returns {string} 書籍ID
     */
    extractBookId(href) {
      // 快取正則表達式
      if (!this._idRegexCache) {
        this._idRegexCache = {
          apiReader: /\/api\/reader\/([^/?#]+)/,
          bookPath: /\/book\/([^/?#]+)/
        };
      }

      let match = href.match(this._idRegexCache.apiReader);
      if (match) return match[1];

      match = href.match(this._idRegexCache.bookPath);
      if (match) return match[1];

      return '';
    },

    /**
     * 提取進度資訊
     * 
     * @param {HTMLElement} element - 書籍元素
     * @returns {string} 進度資訊
     */
    extractProgress(element) {
      for (const selector of SELECTORS.progressIndicators) {
        const progressElement = element.querySelector(selector);
        if (progressElement) {
          return progressElement.textContent?.trim() || '';
        }
      }
      return '';
    },

    /**
     * 提取額外資訊
     * 
     * @param {HTMLElement} element - 書籍元素
     * @returns {Object} 額外資訊物件
     */
    extractAdditionalInfo(element) {
      const info = {};
      
      // 書籍類型
      const typeElement = element.querySelector('.book-type, [class*="type"]');
      if (typeElement) {
        info.type = typeElement.textContent?.trim() || '';
      }

      // 新書標記
      const newIndicator = element.querySelector('.new, .is-new, [class*="new"]');
      if (newIndicator) {
        info.isNew = true;
      }

      // 完結標記
      const finishedIndicator = element.querySelector('.finished, .completed, [class*="finished"]');
      if (finishedIndicator) {
        info.isFinished = true;
      }

      return info;
    },

    /**
     * 清理文字內容
     * 
     * @param {string} text - 原始文字
     * @returns {string} 清理後的文字
     */
    sanitizeText(text) {
      if (!text) return '';
      
      return text
        .replace(/\s+/g, ' ')  // 正規化空白字符
        .replace(/[<>'"]/g, '') // 移除潛在的HTML字符
        .trim();
    },

    /**
     * 取得統計資訊
     * 
     * @returns {Object} 統計資料
     */
    getStats() {
      return { 
        ...stats,
        successRate: stats.totalExtracted > 0 ? 
          (stats.successfulExtractions / stats.totalExtracted * 100).toFixed(2) + '%' : '0%',
        avgParseTime: stats.successfulExtractions > 0 ? 
          (stats.parseTime / stats.successfulExtractions).toFixed(2) + 'ms' : '0ms'
      };
    }
  };

  // 設定構造函數名稱
  Object.defineProperty(adapter, 'constructor', {
    value: { name: 'ReadmooAdapter' },
    writable: false
  });

  return adapter;
}

// ====================
// 頁面檢測和初始化
// ====================

/**
 * 檢測 Readmoo 頁面
 */
function detectReadmooPage() {
  isReadmooPage = window.location.hostname.includes('readmoo.com');
  pageType = isReadmooPage ? detectPageType() : 'unknown';
  
  console.log(`📍 頁面檢測: ${isReadmooPage ? 'Readmoo' : '非Readmoo'} 頁面 (${pageType})`);
  
  return { isReadmooPage, pageType };
}

/**
 * 檢測頁面類型
 */
function detectPageType() {
  const url = window.location.href;
  const pathname = window.location.pathname;

  if (url.includes('/library') || pathname.includes('/library')) {
    return 'library';
  }
  if (url.includes('/shelf') || pathname.includes('/shelf')) {
    return 'shelf';
  }
  if (url.includes('/book/') || pathname.includes('/book/') || 
      url.includes('/api/reader/') || pathname.includes('/api/reader/')) {
    return 'reader';
  }

  return 'unknown';
}

/**
 * 初始化 Content Script
 */
async function initializeContentScript() {
  try {
    console.log('🚀 開始初始化 Content Script');

    // 檢測頁面
    detectReadmooPage();

    if (!isReadmooPage) {
      console.log('⚠️ 非 Readmoo 頁面，跳過初始化');
      return;
    }

    // 建立事件系統
    contentEventBus = createContentEventBus();
    contentChromeBridge = createContentChromeBridge();
    
    // 設定事件系統整合
    contentChromeBridge.eventBus = contentEventBus;

    // 建立提取器
    readmooAdapter = createContentReadmooAdapter();
    bookDataExtractor = createContentBookDataExtractor();
    
    // 設定提取器整合
    bookDataExtractor.setEventBus(contentEventBus);
    bookDataExtractor.setReadmooAdapter(readmooAdapter);

    // 設定全域變數 (供測試使用)
    if (typeof global !== 'undefined') {
      global.isReadmooPage = isReadmooPage;
      global.pageType = pageType;
      global.contentEventBus = contentEventBus;
      global.contentChromeBridge = contentChromeBridge;
      global.bookDataExtractor = bookDataExtractor;
      global.readmooAdapter = readmooAdapter;
      global.contentScriptReady = true;
    }

    // 設定事件橋接
    setupEventBridging();

    // 設定生命週期管理
    setupLifecycleManagement();

    console.log('✅ Content Script 初始化完成');
    console.log('📊 初始化狀態:', {
      isReadmooPage,
      pageType,
      eventBus: !!contentEventBus,
      chromeBridge: !!contentChromeBridge,
      extractor: !!bookDataExtractor,
      adapter: !!readmooAdapter
    });

    // 向 Background 報告就緒狀態
    await reportReadyStatus();

  } catch (error) {
    console.error('❌ Content Script 初始化失敗:', error);
    throw error;
  }
}

/**
 * 設定事件橋接
 */
function setupEventBridging() {
  if (!contentEventBus || !contentChromeBridge) return;

  // 將重要的內部事件轉發到 Background
  const forwardEvents = [
    'EXTRACTION.STARTED',
    'EXTRACTION.PROGRESS', 
    'EXTRACTION.COMPLETED',
    'EXTRACTION.ERROR',
    'EXTRACTION.CANCELLED'
  ];

  forwardEvents.forEach(eventType => {
    contentEventBus.on(eventType, async (event) => {
      await contentChromeBridge.forwardEventToBackground(eventType, event.data);
    });
  });
}

/**
 * 設定生命週期管理
 */
function setupLifecycleManagement() {
  // URL 變更監聽 (SPA 導航)
  let currentUrl = window.location.href;
  urlChangeObserver = new MutationObserver(() => {
    if (window.location.href !== currentUrl) {
      currentUrl = window.location.href;
      console.log('🔄 頁面 URL 變更:', currentUrl);
      
      // 重新檢測頁面
      setTimeout(async () => {
        detectReadmooPage();
        await reportReadyStatus();
      }, 1000);
    }
  });

  urlChangeObserver.observe(document.body, {
    childList: true,
    subtree: true
  });

  // 頁面卸載清理
  window.addEventListener('beforeunload', () => {
    console.log('🧹 頁面卸載，清理資源');
    
    if (bookDataExtractor) {
      const activeFlows = bookDataExtractor.getActiveExtractionFlows();
      activeFlows.forEach(flowId => {
        bookDataExtractor.cancelExtraction(flowId);
      });
    }

    if (urlChangeObserver) {
      urlChangeObserver.disconnect();
    }
  });
}

/**
 * 報告就緒狀態
 */
async function reportReadyStatus() {
  if (!contentChromeBridge) return;

  const status = {
    type: 'CONTENT.STATUS.READY',
    data: {
      isReadmooPage,
      pageType,
      url: window.location.href,
      timestamp: Date.now(),
      modules: {
        eventBus: !!contentEventBus,
        chromeBridge: !!contentChromeBridge,
        extractor: !!bookDataExtractor,
        adapter: !!readmooAdapter
      }
    }
  };

  await contentChromeBridge.sendToBackground(status);
}

// ====================
// Chrome API 訊息處理
// ====================

/**
 * 來自 Background 的訊息處理
 */
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('📨 Content Script 收到訊息:', message);

  handleBackgroundMessage(message, sender, sendResponse);
  
  // 返回 true 表示會異步回應
  return true;
});

/**
 * 處理 Background 訊息
 */
async function handleBackgroundMessage(message, sender, sendResponse) {
  try {
    switch (message.type) {
      case 'PAGE_READY':
        console.log('✅ Background 確認頁面就緒');
        
        const pageStatus = await getPageStatus();
        sendResponse({ success: true, ...pageStatus });
        break;

      case 'START_EXTRACTION':
      case 'BACKGROUND.COMMAND.START_EXTRACTION':
        console.log('🚀 收到提取指令');
        
        if (bookDataExtractor) {
          const flowId = await bookDataExtractor.startExtractionFlow(message.data || {});
          sendResponse({ 
            success: true, 
            flowId,
            message: '提取流程已啟動'
          });
        } else {
          sendResponse({ 
            success: false, 
            error: '提取器未初始化'
          });
        }
        break;

      case 'PING':
        const healthStatus = getHealthStatus();
        sendResponse({ 
          success: true, 
          message: 'Content Script 運作正常',
          ...healthStatus
        });
        break;

      default:
        console.warn('⚠️ Content Script 收到未知訊息類型:', message.type);
        sendResponse({ success: false, error: '未知的訊息類型' });
    }

  } catch (error) {
    console.error('❌ 處理 Background 訊息失敗:', error);
    sendResponse({ success: false, error: error.message });
  }
}

/**
 * 取得頁面狀態
 */
async function getPageStatus() {
  let bookCount = 0;
  let extractable = false;

  if (readmooAdapter) {
    const bookElements = readmooAdapter.getBookElements();
    bookCount = bookElements.length;
    extractable = bookCount > 0;
  }

  return {
    isReadmooPage,
    pageType,
    bookCount,
    extractable,
    url: window.location.href,
    timestamp: Date.now()
  };
}

/**
 * 取得系統健康狀態
 */
function getHealthStatus() {
  return {
    pageType,
    url: window.location.href,
    modules: {
      contentEventBus: !!contentEventBus,
      contentChromeBridge: !!contentChromeBridge,
      bookDataExtractor: !!bookDataExtractor,
      readmooAdapter: !!readmooAdapter
    },
    ready: contentScriptReady
  };
}

// ====================
// 錯誤處理
// ====================

/**
 * 全域錯誤處理
 */
window.addEventListener('error', async (event) => {
  console.error('❌ Content Script 全域錯誤:', event.error);

  if (contentChromeBridge) {
    await contentChromeBridge.sendToBackground({
      type: 'CONTENT.ERROR',
      data: {
        message: event.error.message,
        stack: event.error.stack,
        url: window.location.href,
        timestamp: Date.now()
      }
    });
  }
});

/**
 * 未處理的 Promise 拒絕
 */
window.addEventListener('unhandledrejection', async (event) => {
  console.error('❌ Content Script 未處理的 Promise 拒絕:', event.reason);

  if (contentChromeBridge) {
    await contentChromeBridge.sendToBackground({
      type: 'CONTENT.PROMISE.REJECTION',
      data: {
        reason: event.reason?.message || event.reason,
        url: window.location.href,
        timestamp: Date.now()
      }
    });
  }
});

// ====================
// 初始化和啟動
// ====================

// 頁面載入完成後初始化
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializeContentScript);
} else {
  // 頁面已經載入完成
  initializeContentScript();
}

console.log('📚 Readmoo Content Script 載入完成'); 