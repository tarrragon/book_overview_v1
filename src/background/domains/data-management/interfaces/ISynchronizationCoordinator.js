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
      throw new Error('ISynchronizationCoordinator 是抽象類別，不能直接實例化')
    }

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
    throw new Error('initializeSync() 必須在子類別中實作')
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
    throw new Error('executeSync() 必須在子類別中實作')
  }

  /**
   * 取消同步作業
   * @param {string} syncId - 同步作業ID
   * @param {string} reason - 取消原因
   * @returns {Promise<boolean>} 取消是否成功
   * @abstract
   */
  async cancelSync (syncId, reason = 'User requested') {
    throw new Error('cancelSync() 必須在子類別中實作')
  }

  /**
   * 獲取同步作業狀態
   * @param {string} syncId - 同步作業ID
   * @returns {Promise<Object>} 同步狀態
   * @abstract
   */
  async getSyncStatus (syncId) {
    throw new Error('getSyncStatus() 必須在子類別中實作')
  }

  /**
   * 獲取同步進度
   * @param {string} syncId - 同步作業ID
   * @returns {Promise<Object>} 進度資訊
   * @abstract
   */
  async getSyncProgress (syncId) {
    throw new Error('getSyncProgress() 必須在子類別中實作')
  }

  /**
   * 清理同步作業資源
   * @param {string} syncId - 同步作業ID
   * @returns {Promise<boolean>} 清理是否成功
   * @abstract
   */
  async cleanupSync (syncId) {
    throw new Error('cleanupSync() 必須在子類別中實作')
  }

  /**
   * 獲取同步歷史記錄
   * @param {Object} filters - 篩選條件
   * @returns {Promise<Array>} 歷史記錄陣列
   * @abstract
   */
  async getSyncHistory (filters = {}) {
    throw new Error('getSyncHistory() 必須在子類別中實作')
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
    throw new Error('estimateSyncTime() 必須在子類別中實作')
  }

  /**
   * 驗證同步參數
   * @param {Object} params - 同步參數
   * @returns {Promise<Object>} 驗證結果
   * @abstract
   */
  async validateSyncParams (params) {
    throw new Error('validateSyncParams() 必須在子類別中實作')
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
    throw new Error('dryRun() 必須在子類別中實作')
  }

  /**
   * 設置同步進度回調
   * @param {string} syncId - 同步作業ID
   * @param {Function} callback - 進度回調函數
   * @returns {Promise<boolean>} 設置是否成功
   * @abstract
   */
  async setProgressCallback (syncId, callback) {
    throw new Error('setProgressCallback() 必須在子類別中實作')
  }

  /**
   * 獲取支援的同步策略列表
   * @returns {Promise<Array>} 策略列表
   * @abstract
   */
  async getSupportedStrategies () {
    throw new Error('getSupportedStrategies() 必須在子類別中實作')
  }

  /**
   * 獲取同步統計資訊
   * @param {Object} filters - 篩選條件
   * @returns {Promise<Object>} 統計資訊
   * @abstract
   */
  async getSyncStatistics (filters = {}) {
    throw new Error('getSyncStatistics() 必須在子類別中實作')
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
