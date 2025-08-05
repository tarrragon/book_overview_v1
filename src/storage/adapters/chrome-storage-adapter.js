/**
 * ChromeStorageAdapter - Chrome Storage API 適配器
 * 
 * 負責功能：
 * - Chrome Storage API 整合 (chrome.storage.local)
 * - 儲存操作 (save, load, delete, clear)
 * - 配額管理和清理策略
 * - 錯誤處理和恢復機制
 * - 效能監控和統計追蹤
 * 
 * 設計考量：
 * - 實現統一的儲存適配器介面
 * - 支援並發操作和鎖定機制
 * - 提供詳細的錯誤分析和恢復
 * - 智能配額管理和數據清理
 * 
 * 處理流程：
 * 1. 初始化和配置
 * 2. 檢查Chrome Storage API可用性
 * 3. 執行儲存操作（支援並發和鎖定）
 * 4. 配額監控和自動清理
 * 5. 統計追蹤和效能監控
 * 
 * 使用情境：
 * - Chrome Extension主要儲存方案
 * - 支援大容量數據儲存
 * - 需要配額管理的場景
 * - 要求高可靠性的數據操作
 * 
 * @version 1.0.0
 * @since 2025-07-31
 */

class ChromeStorageAdapter {
  /**
   * 建構 ChromeStorageAdapter 實例
   * 
   * @param {Object} options - 配置選項
   */
  constructor(options = {}) {
    this.type = 'chrome.storage';
    this.name = 'ChromeStorageAdapter';
    
    // 常數定義
    this.STORAGE_TYPES = {
      CHROME_STORAGE: 'chrome.storage',
      LOCAL_STORAGE: 'localStorage',
      INDEXED_DB: 'indexedDB'
    };
    
    this.ERROR_TYPES = {
      API_UNAVAILABLE: 'API_UNAVAILABLE',
      SAVE_ERROR: 'SAVE_ERROR',
      LOAD_ERROR: 'LOAD_ERROR',
      DELETE_ERROR: 'DELETE_ERROR',
      CLEAR_ERROR: 'CLEAR_ERROR',
      QUOTA_EXCEEDED: 'QUOTA_EXCEEDED',
      CLEANUP_ERROR: 'CLEANUP_ERROR'
    };
    
    this.CLEANUP_STRATEGIES = {
      AGE_BASED: 'age_based',
      MANUAL: 'manual',
      AUTO: 'auto'
    };
    
    // 預設配置
    this.config = this.initializeConfig(options);
    
    // 初始化統計資訊
    this.stats = this.initializeStats();
    this.errorStats = this.initializeErrorStats();
    this.performanceMetrics = this.initializePerformanceMetrics();
    
    // 並發控制
    this.locks = new Map();
    this.operationQueue = new Map();
    
    // 壓縮工具 (簡化實現)
    this.compression = this.initializeCompression();
  }
  
  /**
   * 檢查 Chrome Storage API 是否可用
   * 
   * @returns {boolean} API是否可用
   */
  isAvailable() {
    try {
      return !!(typeof chrome !== 'undefined' && 
                chrome.storage && 
                chrome.storage.local);
    } catch (error) {
      return false;
    }
  }
  
  /**
   * 儲存數據
   * 
   * @param {string} key - 儲存鍵
   * @param {any} data - 要儲存的數據
   * @param {Object} options - 選項
   * @returns {Promise<Object>} 儲存結果
   */
  async save(key, data, options = {}) {
    const startTime = performance.now();
    
    try {
      // 1. 前置檢查
      await this.checkApiAvailability();
      
      // 2. 加鎖
      await this.acquireLock(key);
      
      // 3. 檢查配額
      if (!options.skipQuotaCheck) {
        await this.checkQuotaBeforeSave(data);
      }
      
      // 4. 處理數據壓縮
      const processedData = await this.processDataForSave(data);
      
      // 5. 執行儲存
      const result = await this.performSave(key, processedData);
      
      // 6. 更新統計
      this.updateSaveStats(result);
      
      return result;
      
    } catch (error) {
      this.updateErrorStats('SAVE_ERROR', error);
      throw error;
    } finally {
      this.releaseLock(key);
      this.updatePerformanceMetrics('save', performance.now() - startTime);
    }
  }
  
  /**
   * 載入數據
   * 
   * @param {string} key - 儲存鍵
   * @param {Object} options - 選項
   * @returns {Promise<any>} 載入的數據
   */
  async load(key, options = {}) {
    const startTime = performance.now();
    
    try {
      // 1. 前置檢查
      await this.checkApiAvailability();
      
      // 2. 執行載入
      const result = await this.performLoad(key);
      
      // 3. 處理數據解壓縮
      const processedData = await this.processDataFromLoad(result);
      
      // 4. 更新統計
      this.updateLoadStats(processedData !== null);
      
      return processedData;
      
    } catch (error) {
      this.updateErrorStats('LOAD_ERROR', error);
      throw error;
    } finally {
      this.updatePerformanceMetrics('load', performance.now() - startTime);
    }
  }
  
  /**
   * 刪除數據
   * 
   * @param {string} key - 儲存鍵
   * @param {Object} options - 選項
   * @returns {Promise<Object>} 刪除結果
   */
  async delete(key, options = {}) {
    const startTime = performance.now();
    
    try {
      // 1. 前置檢查
      await this.checkApiAvailability();
      
      // 2. 加鎖
      await this.acquireLock(key);
      
      // 3. 執行刪除
      const result = await this.performDelete(key);
      
      // 4. 更新統計
      this.updateDeleteStats();
      
      return result;
      
    } catch (error) {
      this.updateErrorStats('DELETE_ERROR', error);
      throw error;
    } finally {
      this.releaseLock(key);
      this.updatePerformanceMetrics('delete', performance.now() - startTime);
    }
  }
  
  /**
   * 清空所有數據
   * 
   * @param {Object} options - 選項
   * @returns {Promise<Object>} 清空結果
   */
  async clear(options = {}) {
    const startTime = performance.now();
    
    try {
      // 1. 前置檢查
      await this.checkApiAvailability();
      
      // 2. 執行清空
      await this.performClear();
      
      // 3. 更新統計
      this.updateClearStats();
      
      return { success: true, timestamp: Date.now() };
      
    } catch (error) {
      this.updateErrorStats('CLEAR_ERROR', error);
      throw error;
    } finally {
      this.updatePerformanceMetrics('clear', performance.now() - startTime);
    }
  }
  
  /**
   * 批量操作
   * 
   * @param {Array} operations - 操作列表
   * @returns {Promise<Array>} 操作結果
   */
  async batch(operations) {
    const results = [];
    
    for (const operation of operations) {
      try {
        let result;
        switch (operation.type) {
          case 'save':
            result = await this.save(operation.key, operation.data);
            break;
          case 'load':
            result = await this.load(operation.key);
            break;
          case 'delete':
            result = await this.delete(operation.key);
            break;
          default:
            throw new Error(`Unsupported operation type: ${operation.type}`);
        }
        
        results.push({ success: true, result, operation });
      } catch (error) {
        results.push({ success: false, error: error.message, operation });
      }
    }
    
    return results;
  }
  
  /**
   * 檢查配額資訊
   * 
   * @returns {Promise<Object>} 配額資訊
   */
  async checkQuota() {
    const usedBytes = await this.getBytesInUse();
    const maxBytes = this.config.maxSize;
    const availableBytes = maxBytes - usedBytes;
    const usagePercentage = Math.round((usedBytes / maxBytes) * 100);
    
    return {
      usedBytes,
      maxBytes,
      availableBytes,
      usagePercentage,
      isNearLimit: usagePercentage >= (this.config.quotaWarningThreshold * 100)
    };
  }
  
  /**
   * 獲取儲存資訊
   * 
   * @returns {Promise<Object>} 儲存資訊
   */
  async getStorageInfo() {
    const usedBytes = await this.getBytesInUse();
    const quotaInfo = await this.checkQuota();
    
    return {
      ...quotaInfo,
      type: this.type,
      name: this.name,
      config: { ...this.config }
    };
  }
  
  /**
   * 清理儲存空間
   * 
   * @param {string} strategy - 清理策略
   * @param {Object} options - 選項
   * @returns {Promise<Object>} 清理結果
   */
  async cleanup(strategy = 'auto', options = {}) {
    try {
      let result;
      
      switch (strategy) {
        case 'age_based':
          result = await this.cleanupByAge(options);
          break;
        case 'manual':
          result = await this.cleanupManual(options);
          break;
        case 'auto':
          result = await this.cleanupAuto(options);
          break;
        default:
          throw new Error(`Unsupported cleanup strategy: ${strategy}`);
      }
      
      return result;
    } catch (error) {
      this.updateErrorStats('CLEANUP_ERROR', error);
      throw error;
    }
  }
  
  /**
   * 獲取統計資訊
   * 
   * @returns {Object} 統計資訊
   */
  getStats() {
    return {
      ...this.stats,
      totalOperations: this.stats.operations.save + 
                      this.stats.operations.load + 
                      this.stats.operations.delete + 
                      this.stats.operations.clear
    };
  }
  
  /**
   * 獲取錯誤統計
   * 
   * @returns {Object} 錯誤統計
   */
  getErrorStats() {
    return { ...this.errorStats };
  }
  
  /**
   * 獲取效能指標
   * 
   * @returns {Object} 效能指標
   */
  getPerformanceMetrics() {
    return { ...this.performanceMetrics };
  }
  
  /**
   * 獲取健康狀態
   * 
   * @returns {Promise<Object>} 健康狀態
   */
  async getHealthStatus() {
    const startTime = performance.now();
    const isApiAvailable = this.isAvailable();
    const responseTime = performance.now() - startTime;
    
    const totalOperations = this.getStats().totalOperations;
    const totalErrors = this.errorStats.totalErrors;
    const errorRate = totalOperations > 0 ? (totalErrors / totalOperations) * 100 : 0;
    
    return {
      isHealthy: isApiAvailable && errorRate < 10, // 錯誤率低於10%認為健康
      apiAvailable: isApiAvailable,
      responseTime,
      errorRate,
      lastCheck: Date.now()
    };
  }
  
  /**
   * 檢查鎖定狀態
   * 
   * @param {string} key - 鍵
   * @returns {boolean} 是否被鎖定
   */
  isLocked(key) {
    return this.locks.has(key);
  }
  
  // =================== 私有方法 ===================
  
  /**
   * 檢查API可用性
   */
  async checkApiAvailability() {
    if (!this.isAvailable()) {
      throw new Error('Chrome Storage API is not available');
    }
    
    if (chrome.runtime.lastError) {
      throw new Error(chrome.runtime.lastError.message);
    }
  }
  
  /**
   * 獲取使用的位元組數
   */
  async getBytesInUse() {
    return new Promise((resolve, reject) => {
      chrome.storage.local.getBytesInUse(null, (bytes) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
        } else {
          resolve(bytes);
        }
      });
    });
  }
  
  /**
   * 執行儲存操作
   */
  async performSave(key, data) {
    return new Promise((resolve, reject) => {
      chrome.storage.local.set({ [key]: data }, () => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
        } else {
          resolve({
            success: true,
            key,
            size: JSON.stringify(data).length,
            compressed: data._compressed || false,
            originalSize: data._originalSize || undefined,
            compressedSize: data._compressedSize || undefined,
            timestamp: Date.now()
          });
        }
      });
    });
  }
  
  /**
   * 執行載入操作
   */
  async performLoad(key) {
    return new Promise((resolve, reject) => {
      chrome.storage.local.get([key], (result) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
        } else {
          resolve(result[key] || null);
        }
      });
    });
  }
  
  /**
   * 執行刪除操作
   */
  async performDelete(key) {
    return new Promise((resolve, reject) => {
      chrome.storage.local.remove([key], () => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
        } else {
          resolve({
            success: true,
            key,
            timestamp: Date.now()
          });
        }
      });
    });
  }
  
  /**
   * 執行清空操作
   */
  async performClear() {
    return new Promise((resolve, reject) => {
      chrome.storage.local.clear(() => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
        } else {
          resolve();
        }
      });
    });
  }
  
  /**
   * 處理儲存前的數據
   */
  async processDataForSave(data) {
    if (!this.config.compressionEnabled) {
      return data;
    }
    
    const serialized = JSON.stringify(data);
    if (serialized.length <= this.config.compressionThreshold) {
      return data;
    }
    
    // 使用壓縮工具
    const compressed = this.compression.compress(data);
    return {
      _compressed: true,
      _originalSize: compressed.originalSize,
      _compressedSize: compressed.compressedSize,
      data: compressed.data
    };
  }
  
  /**
   * 處理載入後的數據
   */
  async processDataFromLoad(rawData) {
    if (!rawData) {
      return null;
    }
    
    if (rawData._compressed) {
      return this.compression.decompress(rawData.data);
    }
    
    return rawData;
  }
  
  /**
   * 檢查儲存前的配額
   */
  async checkQuotaBeforeSave(data) {
    const dataSize = JSON.stringify(data).length;
    const currentUsage = await this.getBytesInUse();
    
    if (currentUsage + dataSize > this.config.maxSize) {
      throw this.createError(this.ERROR_TYPES.QUOTA_EXCEEDED, 
        `Storage quota exceeded. Required: ${dataSize} bytes, Available: ${this.config.maxSize - currentUsage} bytes`);
    }
  }
  
  /**
   * 創建標準化錯誤
   * 
   * @param {string} type - 錯誤類型
   * @param {string} message - 錯誤訊息
   * @param {Error} [originalError] - 原始錯誤
   * @returns {Error} 標準化錯誤
   */
  createError(type, message, originalError = null) {
    const error = new Error(message);
    error.name = 'ChromeStorageAdapterError';
    error.type = type;
    error.timestamp = Date.now();
    error.adapterName = this.name;
    
    if (originalError) {
      error.cause = originalError;
      error.stack = `${error.stack}\nCaused by: ${originalError.stack}`;
    }
    
    return error;
  }
  
  /**
   * 獲取/釋放鎖
   */
  async acquireLock(key) {
    if (this.locks.has(key)) {
      // 等待鎖釋放
      await new Promise(resolve => {
        const check = () => {
          if (!this.locks.has(key)) {
            resolve();
          } else {
            setTimeout(check, 10);
          }
        };
        check();
      });
    }
    
    this.locks.set(key, Date.now());
  }
  
  releaseLock(key) {
    this.locks.delete(key);
  }
  
  /**
   * 清理策略實現
   */
  async cleanupByAge(options = {}) {
    const maxAge = options.maxAge || 86400000 * 30; // 30天
    const now = Date.now();
    
    return new Promise((resolve, reject) => {
      chrome.storage.local.get(null, (items) => {
        if (chrome.runtime.lastError) {
          reject(this.createError(this.ERROR_TYPES.CLEANUP_ERROR, 
            chrome.runtime.lastError.message));
          return;
        }
        
        const keysToDelete = [];
        let oldestKey = null;
        let oldestTime = now;
        
        for (const [key, value] of Object.entries(items)) {
          if (value && value.timestamp) {
            const age = now - value.timestamp;
            if (age > maxAge) {
              keysToDelete.push(key);
            }
            if (value.timestamp < oldestTime) {
              oldestTime = value.timestamp;
              oldestKey = key;
            }
          }
        }
        
        // 如果沒有過期的，刪除最舊的
        if (keysToDelete.length === 0 && oldestKey) {
          keysToDelete.push(oldestKey);
        }
        
        if (keysToDelete.length > 0) {
          chrome.storage.local.remove(keysToDelete, () => {
            if (chrome.runtime.lastError) {
              reject(this.createError(this.ERROR_TYPES.CLEANUP_ERROR, 
                chrome.runtime.lastError.message));
            } else {
              resolve({
                success: true,
                deletedKeys: keysToDelete,
                freedBytes: keysToDelete.length * 1000, // 估算
                strategy: this.CLEANUP_STRATEGIES.AGE_BASED,
                timestamp: now
              });
            }
          });
        } else {
          resolve({
            success: true,
            deletedKeys: [],
            freedBytes: 0,
            strategy: this.CLEANUP_STRATEGIES.AGE_BASED,
            timestamp: now
          });
        }
      });
    });
  }
  
  async cleanupManual(options = {}) {
    const keysToDelete = options.keys || [];
    
    // 處理通配符
    const actualKeys = keysToDelete.filter(key => !key.includes('*'));
    
    if (actualKeys.length === 0) {
      return {
        success: true,
        deletedKeys: [],
        freedBytes: 0,
        strategy: this.CLEANUP_STRATEGIES.MANUAL,
        timestamp: Date.now()
      };
    }
    
    return new Promise((resolve, reject) => {
      chrome.storage.local.remove(actualKeys, () => {
        if (chrome.runtime.lastError) {
          reject(this.createError(this.ERROR_TYPES.CLEANUP_ERROR, 
            chrome.runtime.lastError.message));
        } else {
          resolve({
            success: true,
            deletedKeys: actualKeys,
            freedBytes: actualKeys.length * 1000, // 估算
            strategy: this.CLEANUP_STRATEGIES.MANUAL,
            timestamp: Date.now()
          });
        }
      });
    });
  }
  
  async cleanupAuto(options = {}) {
    const quotaInfo = await this.checkQuota();
    
    if (quotaInfo.isNearLimit) {
      return await this.cleanupByAge(options);
    }
    
    return {
      success: true,
      deletedKeys: [],
      freedBytes: 0,
      strategy: this.CLEANUP_STRATEGIES.AUTO,
      timestamp: Date.now()
    };
  }
  
  /**
   * 統計更新方法
   */
  updateSaveStats(result) {
    this.stats.operations.save++;
    this.stats.totalBytesStored += result.size || 0;
    this.updateAverageItemSize();
    
    // 更新壓縮統計
    if (result.compressed) {
      if (!this.stats.compression) {
        this.stats.compression = { totalCompressed: 0, totalSaved: 0 };
      }
      this.stats.compression.totalCompressed++;
      this.stats.compression.totalSaved += (result.originalSize - result.compressedSize) || 0;
    }
  }
  
  updateLoadStats(success) {
    this.stats.operations.load++;
    if (success) {
      this.stats.successfulLoads = (this.stats.successfulLoads || 0) + 1;
    }
  }
  
  updateDeleteStats() {
    this.stats.operations.delete++;
  }
  
  updateClearStats() {
    this.stats.operations.clear++;
    this.stats.totalBytesStored = 0;
    this.stats.averageItemSize = 0;
  }
  
  updateErrorStats(type, error) {
    this.errorStats.totalErrors++;
    if (!this.errorStats.errorsByType[type]) {
      this.errorStats.errorsByType[type] = 0;
    }
    this.errorStats.errorsByType[type]++;
    
    // 記錄錯誤詳情
    if (!this.errorStats.errorDetails) {
      this.errorStats.errorDetails = [];
    }
    this.errorStats.errorDetails.push({
      type,
      message: error.message,
      timestamp: Date.now(),
      stack: error.stack
    });
    
    // 保持最近100個錯誤記錄
    if (this.errorStats.errorDetails.length > 100) {
      this.errorStats.errorDetails = this.errorStats.errorDetails.slice(-100);
    }
  }
  
  updatePerformanceMetrics(operation, time) {
    this.performanceMetrics.lastOperationTime = time;
    this.performanceMetrics.totalTime += time;
    this.performanceMetrics.operationCount++;
    this.performanceMetrics.averageResponseTime = 
      this.performanceMetrics.totalTime / this.performanceMetrics.operationCount;
    
    // 更新操作類型統計
    if (!this.performanceMetrics.operationTimes) {
      this.performanceMetrics.operationTimes = {};
    }
    if (!this.performanceMetrics.operationTimes[operation]) {
      this.performanceMetrics.operationTimes[operation] = [];
    }
    this.performanceMetrics.operationTimes[operation].push(time);
    
    // 保持最近50個時間記錄
    if (this.performanceMetrics.operationTimes[operation].length > 50) {
      this.performanceMetrics.operationTimes[operation] = 
        this.performanceMetrics.operationTimes[operation].slice(-50);
    }
  }
  
  updateAverageItemSize() {
    const totalOperations = this.stats.operations.save;
    if (totalOperations > 0) {
      this.stats.averageItemSize = this.stats.totalBytesStored / totalOperations;
    }
  }
  
  /**
   * 初始化統計物件
   */
  initializeStats() {
    return {
      operations: {
        save: 0,
        load: 0,
        delete: 0,
        clear: 0
      },
      totalBytesStored: 0,
      averageItemSize: 0
    };
  }
  
  initializeErrorStats() {
    return {
      totalErrors: 0,
      errorsByType: {},
      errorDetails: []
    };
  }
  
  initializePerformanceMetrics() {
    return {
      lastOperationTime: 0,
      totalTime: 0,
      operationCount: 0,
      averageResponseTime: 0,
      operationTimes: {}
    };
  }

  /**
   * 初始化配置
   * 
   * @param {Object} options - 使用者選項
   * @returns {Object} 完整配置
   */
  initializeConfig(options) {
    return {
      maxSize: options.maxSize || 10485760, // 10MB 預設
      keyPrefix: options.keyPrefix || 'readmoo_',
      compressionEnabled: options.compressionEnabled !== undefined ? options.compressionEnabled : true,
      compressionThreshold: options.compressionThreshold || 1024, // 1KB
      retryAttempts: options.retryAttempts || 3,
      retryDelay: options.retryDelay || 1000,
      quotaWarningThreshold: options.quotaWarningThreshold || 0.9, // 90%
      timeoutMs: options.timeoutMs || 30000, // 30秒
      maxConcurrentOperations: options.maxConcurrentOperations || 10,
      ...options
    };
  }
  
  /**
   * 初始化壓縮工具
   * 
   * @returns {Object} 壓縮工具對象
   */
  initializeCompression() {
    return {
      compress: (data) => {
        // 簡化實現：實際可使用 LZ-string 或其他壓縮庫
        const serialized = JSON.stringify(data);
        // 模擬壓縮：移除空格和縮排
        const compressed = serialized.replace(/\s+/g, '');
        return {
          compressed: true,
          data: compressed,
          originalSize: serialized.length,
          compressedSize: compressed.length
        };
      },
      decompress: (compressedData) => {
        if (typeof compressedData === 'string') {
          return JSON.parse(compressedData);
        }
        return compressedData;
      }
    };
  }
}

module.exports = ChromeStorageAdapter; 