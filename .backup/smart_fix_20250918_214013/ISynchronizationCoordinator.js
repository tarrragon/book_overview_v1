/**
 * @fileoverview ISynchronizationCoordinator - 同步協調器抽象介面
 * @version 1.0.0
 * @since 2025-08-19
 *
 * 負責功能：
 * - 定義同步協調器的標準介面
 * - 支援依賴反轉原則和多型實作
 * - 為 Readmoo 和未來多平台提供統一抽象
 *
 * 設計考量：
 * - 抽象類別設計，強制實作關鍵方法
 * - 事件驅動架構整合
 * - 完整的同步生命週期定義
 * - 錯誤處理和進度追蹤標準化
 *
 * 使用情境：
 * - ReadmooSynchronizationCoordinator 實作此介面
 * - 未來其他平台同步協調器的基礎
 * - 同步編排器的依賴注入目標
 */

// ErrorCodes is already imported by the file header
const { ErrorCodes } = require('src/core/errors/ErrorCodes')

/**
 * 同步協調器抽象介面
 *
 * 定義所有同步協調器必須實作的核心方法，
 * 確保不同平台實作的一致性和互換性。
 */
class ISynchronizationCoordinator {
  /**
   * 建構同步協調器
   * @param {Object} dependencies - 依賴注入物件
   */
  constructor (dependencies = {}) {
    if (new.target === ISynchronizationCoordinator) {
      const error = new Error('ISynchronizationCoordinator 是抽象類別，不能直接實例化')
      error.code = ErrorCodes.OPERATION_ERROR
      error.details = {
        className: 'ISynchronizationCoordinator',
        category: 'instantiation'
      }
      throw error
    }

    // Logger 後備方案: Background Service 初始化保護
    // 設計理念: 同步協調器抽象介面需要記錄依賴注入和抽象方法實作狀況
    // 執行環境: Service Worker 初始化階段，依賴注入可能不完整
    // 後備機制: console 確保模組生命週期錯誤能被追蹤
    // 風險考量: 理想上應確保 Logger 完整可用，此為過渡性保護
    this.logger = dependencies.logger || console
    this.storage = dependencies.storage
    this.validator = dependencies.validator
    this.eventBus = dependencies.eventBus
  }

  /**
   * 初始化同步協調器
   * @param {string} syncId - 同步作業ID
   * @param {Object} options - 初始化選項
   * @returns {Promise<Object>} 初始化結果
   * @abstract
   */
  async initializeSync (syncId, options = {}) {
    const error = new Error('initializeSync() 必須在子類別中實作')
    error.code = ErrorCodes.OPERATION_ERROR
    error.details = {
      method: 'initializeSync',
      className: 'ISynchronizationCoordinator',
      category: 'implementation'
    }
    throw error
  }

  /**
   * 執行同步作業
   * @param {string} syncId - 同步作業ID
   * @param {Array} sourceData - 源資料
   * @param {Array} targetData - 目標資料
   * @param {string} strategy - 同步策略
   * @returns {Promise<Object>} 同步結果
   * @abstract
   */
  async executeSync (syncId, sourceData, targetData, strategy = 'MERGE') {
    const error = new Error('executeSync() 必須在子類別中實作')
    error.code = ErrorCodes.OPERATION_ERROR
    error.details = {
      method: 'executeSync',
      className: 'ISynchronizationCoordinator',
      category: 'implementation'
    }
    throw error
  }

  /**
   * 取消同步作業
   * @param {string} syncId - 同步作業ID
   * @param {string} reason - 取消原因
   * @returns {Promise<boolean>} 取消是否成功
   * @abstract
   */
  async cancelSync (syncId, reason = 'User requested') {
    const error = new Error('cancelSync() 必須在子類別中實作')
    error.code = ErrorCodes.OPERATION_ERROR
    error.details = {
      method: 'cancelSync',
      className: 'ISynchronizationCoordinator',
      category: 'implementation'
    }
    throw error
  }

  /**
   * 獲取同步作業狀態
   * @param {string} syncId - 同步作業ID
   * @returns {Promise<Object>} 同步狀態
   * @abstract
   */
  async getSyncStatus (syncId) {
    const error = new Error('getSyncStatus() 必須在子類別中實作')
    error.code = ErrorCodes.OPERATION_ERROR
    error.details = {
      method: 'getSyncStatus',
      className: 'ISynchronizationCoordinator',
      category: 'implementation'
    }
    throw error
  }

  /**
   * 獲取同步進度
   * @param {string} syncId - 同步作業ID
   * @returns {Promise<Object>} 進度資訊
   * @abstract
   */
  async getSyncProgress (syncId) {
    const error = new Error('getSyncProgress() 必須在子類別中實作')
    error.code = ErrorCodes.OPERATION_ERROR
    error.details = {
      method: 'getSyncProgress',
      className: 'ISynchronizationCoordinator',
      category: 'implementation'
    }
    throw error
  }

  /**
   * 清理同步作業資源
   * @param {string} syncId - 同步作業ID
   * @returns {Promise<boolean>} 清理是否成功
   * @abstract
   */
  async cleanupSync (syncId) {
    const error = new Error('cleanupSync() 必須在子類別中實作')
    error.code = ErrorCodes.OPERATION_ERROR
    error.details = {
      method: 'cleanupSync',
      className: 'ISynchronizationCoordinator',
      category: 'implementation'
    }
    throw error
  }

  /**
   * 獲取同步歷史記錄
   * @param {Object} filters - 篩選條件
   * @returns {Promise<Array>} 歷史記錄陣列
   * @abstract
   */
  async getSyncHistory (filters = {}) {
    const error = new Error('getSyncHistory() 必須在子類別中實作')
    error.code = ErrorCodes.OPERATION_ERROR
    error.details = {
      method: 'getSyncHistory',
      className: 'ISynchronizationCoordinator',
      category: 'implementation'
    }
    throw error
  }

  /**
   * 估算同步時間
   * @param {Array} sourceData - 源資料
   * @param {Array} targetData - 目標資料
   * @param {string} strategy - 同步策略
   * @returns {Promise<number>} 預估時間（毫秒）
   * @abstract
   */
  async estimateSyncTime (sourceData, targetData, strategy = 'MERGE') {
    const error = new Error('estimateSyncTime() 必須在子類別中實作')
    error.code = ErrorCodes.OPERATION_ERROR
    error.details = {
      method: 'estimateSyncTime',
      className: 'ISynchronizationCoordinator',
      category: 'implementation'
    }
    throw error
  }

  /**
   * 驗證同步參數
   * @param {Object} params - 同步參數
   * @returns {Promise<Object>} 驗證結果
   * @abstract
   */
  async validateSyncParams (params) {
    const error = new Error('validateSyncParams() 必須在子類別中實作')
    error.code = ErrorCodes.OPERATION_ERROR
    error.details = {
      method: 'validateSyncParams',
      className: 'ISynchronizationCoordinator',
      category: 'implementation'
    }
    throw error
  }

  /**
   * 執行乾執行（測試同步但不實際修改資料）
   * @param {string} syncId - 同步作業ID
   * @param {Array} sourceData - 源資料
   * @param {Array} targetData - 目標資料
   * @param {string} strategy - 同步策略
   * @returns {Promise<Object>} 乾執行結果
   * @abstract
   */
  async dryRun (syncId, sourceData, targetData, strategy = 'MERGE') {
    const error = new Error('dryRun() 必須在子類別中實作')
    error.code = ErrorCodes.OPERATION_ERROR
    error.details = {
      method: 'dryRun',
      className: 'ISynchronizationCoordinator',
      category: 'implementation'
    }
    throw error
  }

  /**
   * 設置同步進度回調
   * @param {string} syncId - 同步作業ID
   * @param {Function} callback - 進度回調函數
   * @returns {Promise<boolean>} 設置是否成功
   * @abstract
   */
  async setProgressCallback (syncId, callback) {
    const error = new Error('setProgressCallback() 必須在子類別中實作')
    error.code = ErrorCodes.OPERATION_ERROR
    error.details = {
      method: 'setProgressCallback',
      className: 'ISynchronizationCoordinator',
      category: 'implementation'
    }
    throw error
  }

  /**
   * 獲取支援的同步策略列表
   * @returns {Promise<Array>} 策略列表
   * @abstract
   */
  async getSupportedStrategies () {
    const error = new Error('getSupportedStrategies() 必須在子類別中實作')
    error.code = ErrorCodes.OPERATION_ERROR
    error.details = {
      method: 'getSupportedStrategies',
      className: 'ISynchronizationCoordinator',
      category: 'implementation'
    }
    throw error
  }

  /**
   * 獲取同步統計資訊
   * @param {Object} filters - 篩選條件
   * @returns {Promise<Object>} 統計資訊
   * @abstract
   */
  async getSyncStatistics (filters = {}) {
    const error = new Error('getSyncStatistics() 必須在子類別中實作')
    error.code = ErrorCodes.OPERATION_ERROR
    error.details = {
      method: 'getSyncStatistics',
      className: 'ISynchronizationCoordinator',
      category: 'implementation'
    }
    throw error
  }
}

// 導出模組
if (typeof module !== 'undefined' && module.exports) {
  module.exports = ISynchronizationCoordinator
}

// 瀏覽器環境支援
if (typeof window !== 'undefined') {
  window.ISynchronizationCoordinator = ISynchronizationCoordinator
}
