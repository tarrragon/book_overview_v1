/**
 * 儲存請求事件處理器
 * 基於 EventHandler 實現統一的資料儲存處理
 * 
 * 負責功能：
 * - 處理 STORAGE.SAVE.REQUESTED 事件
 * - 驗證儲存資料的完整性和有效性
 * - 調用儲存適配器執行實際儲存操作
 * - 觸發儲存完成或錯誤事件
 * - 記錄儲存操作的統計資訊
 * 
 * 設計考量：
 * - 繼承 EventHandler 提供標準化的事件處理流程
 * - 支援多種儲存適配器 (Chrome Storage, LocalStorage, IndexedDB)
 * - 實現完整的錯誤處理和恢復機制
 * - 提供詳細的操作統計和監控資訊
 * 
 * 處理流程：
 * 1. 接收 STORAGE.SAVE.REQUESTED 事件
 * 2. 驗證事件資料的必要欄位和格式
 * 3. 檢查儲存適配器的可用性和容量
 * 4. 調用適配器執行儲存操作
 * 5. 觸發 STORAGE.SAVE.COMPLETED 或 STORAGE.ERROR 事件
 * 6. 更新執行統計和效能監控
 * 
 * 使用情境：
 * - 處理從提取器傳來的書籍資料儲存請求
 * - 管理用戶設定和偏好的儲存
 * - 實現資料的備份和同步機制
 */

const EventHandler = require('../../core/event-handler');

class StorageSaveHandler extends EventHandler {
  /**
   * 建構儲存事件處理器
   * 
   * @param {Object} eventBus - 事件總線實例
   * @param {Object} storageAdapter - 儲存適配器實例
   * 
   * 負責功能：
   * - 初始化事件處理器基本配置
   * - 設定儲存適配器和事件總線引用
   * - 配置處理器優先級 (儲存操作需要較高優先級)
   */
  constructor(eventBus, storageAdapter) {
    super('StorageSaveHandler', 1); // 儲存操作優先級設為1 (較高)
    
    this.eventBus = eventBus;
    this.storageAdapter = storageAdapter;
    
    // 儲存操作統計
    this.saveCount = 0;
    this.totalSavedSize = 0;
    this.lastSaveResult = null;
    
    // 錯誤類型常數
    this.ERROR_TYPES = {
      INVALID_DATA: 'INVALID_DATA',
      ADAPTER_UNAVAILABLE: 'ADAPTER_UNAVAILABLE',
      SAVE_FAILED: 'SAVE_FAILED',
      VALIDATION_ERROR: 'VALIDATION_ERROR'
    };
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
    return ['STORAGE.SAVE.REQUESTED'];
  }

  /**
   * 處理儲存請求事件的核心邏輯
   * 
   * @param {Object} event - 儲存請求事件
   * @param {string} event.type - 事件類型 (STORAGE.SAVE.REQUESTED)
   * @param {Object} event.data - 要儲存的資料
   * @param {Array} event.data.books - 書籍資料陣列
   * @param {Object} event.data.metadata - 元數據資訊
   * @param {string} event.flowId - 流程追蹤ID
   * @param {number} event.timestamp - 事件時間戳
   * @returns {Promise<Object>} 處理結果
   * 
   * 負責功能：
   * - 驗證事件資料的完整性
   * - 檢查儲存適配器可用性
   * - 執行實際的儲存操作
   * - 處理儲存成功和失敗情況
   * 
   * 設計考量：
   * - 完整的資料驗證確保儲存品質
   * - 詳細的錯誤處理提供問題診斷資訊
   * - 統計資訊收集用於效能監控
   */
  async process(event) {
    const { data, flowId, timestamp } = event;

    try {
      // 1. 前置驗證
      this.validateEvent(event);
      this.validateSaveData(data);
      this.checkStorageAvailability();

      // 2. 準備和執行儲存
      const saveData = this.prepareSaveData(data, timestamp);
      const saveResult = await this.executeSave(saveData);

      // 3. 後處理
      this.updateSaveStats(saveResult);
      await this.emitSaveCompleted(flowId, saveResult);
      this.recordSuccessResult(saveResult);

      return this.buildSuccessResponse(flowId, saveResult);

    } catch (error) {
      // 統一錯誤處理
      await this.handleProcessError(flowId, error);
      throw error; // 重新拋出供上層處理
    }
  }

  /**
   * 驗證事件基本結構
   * 
   * @param {Object} event - 事件物件
   * @throws {Error} 事件結構無效時拋出錯誤
   * 
   * 負責功能：
   * - 檢查事件的基本必要欄位
   * - 驗證事件的整體結構
   */
  validateEvent(event) {
    if (!event || typeof event !== 'object') {
      throw this.createError(
        this.ERROR_TYPES.INVALID_DATA, 
        'Event must be a valid object'
      );
    }

    if (!event.flowId) {
      throw this.createError(
        this.ERROR_TYPES.INVALID_DATA, 
        'Event must have a flowId'
      );
    }
  }

  /**
   * 驗證儲存資料的完整性和有效性
   * 
   * @param {Object} data - 要驗證的資料
   * @throws {Error} 資料驗證失敗時拋出錯誤
   * 
   * 負責功能：
   * - 檢查必要欄位的存在性
   * - 驗證資料格式的正確性
   * - 確保資料的基本品質要求
   */
  validateSaveData(data) {
    if (!data || typeof data !== 'object') {
      throw this.createError(
        this.ERROR_TYPES.VALIDATION_ERROR, 
        'Data must be a valid object'
      );
    }

    if (!data.books || !Array.isArray(data.books)) {
      throw this.createError(
        this.ERROR_TYPES.VALIDATION_ERROR, 
        'Books must be an array'
      );
    }

    if (data.books.length === 0) {
      throw this.createError(
        this.ERROR_TYPES.VALIDATION_ERROR, 
        'Books array cannot be empty'
      );
    }

    // 驗證書籍資料基本結構
    this.validateBooksStructure(data.books);
  }

  /**
   * 驗證書籍資料結構
   * 
   * @param {Array} books - 書籍資料陣列
   * @throws {Error} 書籍結構無效時拋出錯誤
   * 
   * 負責功能：
   * - 檢查每本書的必要欄位
   * - 驗證書籍資料的基本品質
   */
  validateBooksStructure(books) {
    for (let i = 0; i < books.length; i++) {
      const book = books[i];
      if (!book.id || !book.title) {
        throw this.createError(
          this.ERROR_TYPES.VALIDATION_ERROR, 
          `Book at index ${i} must have id and title`
        );
      }
    }
  }

  /**
   * 檢查儲存適配器的可用性
   * 
   * @throws {Error} 適配器不可用時拋出錯誤
   * 
   * 負責功能：
   * - 確認儲存適配器已正確初始化
   * - 檢查適配器的運行狀態
   * - 驗證適配器的基本功能可用性
   */
  checkStorageAvailability() {
    if (!this.storageAdapter) {
      throw this.createError(
        this.ERROR_TYPES.ADAPTER_UNAVAILABLE, 
        'Adapter not initialized'
      );
    }

    if (!this.storageAdapter.isAvailable()) {
      throw this.createError(
        this.ERROR_TYPES.ADAPTER_UNAVAILABLE, 
        'Adapter reports unavailable'
      );
    }

    if (typeof this.storageAdapter.save !== 'function') {
      throw this.createError(
        this.ERROR_TYPES.ADAPTER_UNAVAILABLE, 
        'Save method not implemented'
      );
    }
  }

  /**
   * 準備要儲存的資料
   * 
   * @param {Object} data - 原始資料
   * @param {number} timestamp - 事件時間戳
   * @returns {Object} 準備好的儲存資料
   * 
   * 負責功能：
   * - 補充必要的元數據資訊
   * - 格式化資料結構
   * - 添加時間戳和版本資訊
   */
  prepareSaveData(data, timestamp) {
    const now = Date.now();
    
    return {
      books: data.books,
      metadata: {
        ...data.metadata,
        savedAt: new Date().toISOString(),
        savedTimestamp: timestamp || now,
        handlerVersion: '1.0.0',
        adapterName: this.getAdapterName()
      }
    };
  }

  /**
   * 執行儲存操作
   * 
   * @param {Object} saveData - 準備好的儲存資料
   * @returns {Promise<Object>} 儲存結果
   * 
   * 負責功能：
   * - 調用儲存適配器執行實際儲存
   * - 處理儲存過程中的異常
   */
  async executeSave(saveData) {
    try {
      return await this.storageAdapter.save(saveData);
    } catch (error) {
      throw this.createError(
        this.ERROR_TYPES.SAVE_FAILED, 
        `Save operation failed: ${error.message}`,
        error
      );
    }
  }

  /**
   * 更新儲存操作統計資訊
   * 
   * @param {Object} saveResult - 儲存操作結果
   * 
   * 負責功能：
   * - 累計儲存操作次數
   * - 統計總儲存資料大小
   * - 更新效能指標
   */
  updateSaveStats(saveResult) {
    this.saveCount++;
    
    if (saveResult && saveResult.size && typeof saveResult.size === 'number') {
      this.totalSavedSize += saveResult.size;
    }
  }

  /**
   * 觸發儲存完成事件
   * 
   * @param {string} flowId - 流程追蹤ID
   * @param {Object} saveResult - 儲存結果
   * 
   * 負責功能：
   * - 構建儲存完成事件資料
   * - 通過事件總線發送完成通知
   * - 提供詳細的操作結果資訊
   */
  async emitSaveCompleted(flowId, saveResult) {
    if (!this.hasEventBus()) return;

    await this.eventBus.emit('STORAGE.SAVE.COMPLETED', {
      flowId,
      success: true,
      result: saveResult,
      timestamp: Date.now(),
      handlerName: this.name
    });
  }

  /**
   * 統一的錯誤處理
   * 
   * @param {string} flowId - 流程追蹤ID
   * @param {Error} error - 錯誤物件
   * 
   * 負責功能：
   * - 記錄詳細的錯誤資訊
   * - 觸發儲存錯誤事件
   * - 統一錯誤記錄格式
   */
  async handleProcessError(flowId, error) {
    // 記錄錯誤結果
    this.recordErrorResult(error);
    
    // 觸發錯誤事件
    await this.emitStorageError(flowId, error);
  }

  /**
   * 觸發儲存錯誤事件
   * 
   * @param {string} flowId - 流程追蹤ID
   * @param {Error} error - 錯誤物件
   * 
   * 負責功能：
   * - 構建錯誤事件資料
   * - 通過事件總線發送錯誤通知
   */
  async emitStorageError(flowId, error) {
    if (!this.hasEventBus()) return;

    await this.eventBus.emit('STORAGE.ERROR', {
      flowId,
      error: error.message,
      errorType: error.type || error.constructor.name,
      timestamp: Date.now(),
      handlerName: this.name,
      adapterName: this.getAdapterName()
    });
  }

  /**
   * 記錄成功結果
   * 
   * @param {Object} saveResult - 儲存結果
   * 
   * 負責功能：
   * - 統一記錄成功操作的結果
   * - 提供後續查詢和統計使用
   */
  recordSuccessResult(saveResult) {
    this.lastSaveResult = {
      success: true,
      timestamp: Date.now(),
      result: saveResult
    };
  }

  /**
   * 記錄錯誤結果
   * 
   * @param {Error} error - 錯誤物件
   * 
   * 負責功能：
   * - 統一記錄錯誤操作的結果
   * - 提供後續問題診斷使用
   */
  recordErrorResult(error) {
    this.lastSaveResult = {
      success: false,
      timestamp: Date.now(),
      error: error.message,
      errorType: error.type
    };
  }

  /**
   * 建構成功回應
   * 
   * @param {string} flowId - 流程追蹤ID
   * @param {Object} saveResult - 儲存結果
   * @returns {Object} 格式化的成功回應
   * 
   * 負責功能：
   * - 統一成功回應的格式
   * - 提供一致的API介面
   */
  buildSuccessResponse(flowId, saveResult) {
    return {
      success: true,
      flowId,
      savedAt: saveResult.savedAt,
      size: saveResult.size || 0
    };
  }

  /**
   * 創建帶類型的錯誤物件
   * 
   * @param {string} type - 錯誤類型
   * @param {string} message - 錯誤訊息
   * @param {Error} originalError - 原始錯誤 (可選)
   * @returns {Error} 增強的錯誤物件
   * 
   * 負責功能：
   * - 統一錯誤物件的創建
   * - 添加錯誤類型資訊
   * - 保留原始錯誤的堆疊追蹤
   */
  createError(type, message, originalError) {
    // 根據錯誤類型選擇適當的前綴
    let prefix;
    switch (type) {
      case this.ERROR_TYPES.INVALID_DATA:
      case this.ERROR_TYPES.VALIDATION_ERROR:
        prefix = 'Invalid data';
        break;
      case this.ERROR_TYPES.ADAPTER_UNAVAILABLE:
        prefix = 'Storage adapter not available';
        break;
      case this.ERROR_TYPES.SAVE_FAILED:
        prefix = 'Save operation failed';
        break;
      default:
        prefix = 'Storage error';
    }

    const error = new Error(`${prefix}: ${message}`);
    error.type = type;
    if (originalError) {
      error.originalError = originalError;
    }
    return error;
  }

  /**
   * 檢查是否有事件總線
   * 
   * @returns {boolean} 事件總線可用性
   * 
   * 負責功能：
   * - 統一檢查事件總線的可用性
   * - 避免重複的空值檢查
   */
  hasEventBus() {
    return this.eventBus && typeof this.eventBus.emit === 'function';
  }

  /**
   * 取得適配器名稱
   * 
   * @returns {string} 適配器名稱
   * 
   * 負責功能：
   * - 安全地取得適配器名稱
   * - 提供預設值避免錯誤
   */
  getAdapterName() {
    return this.storageAdapter && typeof this.storageAdapter.getName === 'function' 
      ? this.storageAdapter.getName() 
      : 'unknown';
  }

  /**
   * 取得處理器的統計資訊
   * 
   * @returns {Object} 統計資訊物件
   * 
   * 負責功能：
   * - 提供基本的執行統計 (繼承自 EventHandler)
   * - 補充儲存特定的統計資訊
   * - 計算效能和容量相關指標
   */
  getStats() {
    const baseStats = super.getStats();
    
    return {
      ...baseStats,
      saveCount: this.saveCount,
      totalSavedSize: this.totalSavedSize,
      averageSaveSize: this.saveCount > 0 ? Math.round(this.totalSavedSize / this.saveCount) : 0,
      lastSaveResult: this.lastSaveResult,
      adapterName: this.getAdapterName()
    };
  }
}

module.exports = StorageSaveHandler; 