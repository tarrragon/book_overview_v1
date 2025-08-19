/**
 * ISynchronizationCoordinator - 同步協調器抽象介面
 *
 * 負責功能：
 * - 定義同步協調器的標準介面契約
 * - 統一同步操作的方法簽章和回傳格式
 * - 建立同步狀態管理的抽象規範
 * - 提供錯誤處理的標準化接口
 *
 * 設計考量：
 * - 平台無關性：介面不包含任何平台特定邏輯
 * - 可擴展性：支援未來新增更多同步功能
 * - 一致性：所有同步協調器都遵循相同的介面規範
 * - 可測試性：介面設計便於單元測試和 Mock
 *
 * 處理流程：
 * 1. 定義核心同步操作方法
 * 2. 規範狀態查詢和管理接口
 * 3. 建立配置管理標準
 * 4. 提供效能監控接口
 * 5. 定義生命週期管理方法
 *
 * 使用情境：
 * - 作為所有同步協調器實作類的基礎介面
 * - 提供依賴注入的抽象依賴類型
 * - 建立測試 Mock 物件的標準規範
 * - 支援多種同步策略的統一管理
 *
 * @version 1.0.0
 * @since 2025-08-19
 */

/**
 * 同步協調器抽象介面
 * @interface ISynchronizationCoordinator
 */
class ISynchronizationCoordinator {
  /**
   * 初始化同步作業
   * @param {Object} syncRequest - 同步請求物件
   * @param {string} syncRequest.syncId - 同步作業唯一識別碼
   * @param {string} syncRequest.sourceType - 資料來源類型 (e.g., 'readmoo', 'local')
   * @param {string} syncRequest.targetType - 目標類型
   * @param {Array<string>} syncRequest.scope - 同步範圍 ['books', 'reading-progress']
   * @param {string} syncRequest.strategy - 同步策略 ('SMART_MERGE', 'SOURCE_OVERWRITE', etc.)
   * @returns {Promise<Object>} 同步初始化結果 { syncId, status, estimatedDuration }
   */
  async initializeSync (syncRequest) {
    throw new Error('ISynchronizationCoordinator.initializeSync() must be implemented')
  }

  /**
   * 執行同步作業
   * @param {Object} syncJob - 同步作業物件
   * @param {string} syncJob.jobId - 作業唯一識別碼
   * @param {string} syncJob.syncId - 關聯的同步作業 ID
   * @param {Object} syncJob.data - 要同步的資料
   * @param {Object} syncJob.options - 執行選項 { dryRun, batchSize, priority }
   * @returns {Promise<Object>} 執行結果 { jobId, status, processedRecords, errors }
   */
  async executeSync (syncJob) {
    throw new Error('ISynchronizationCoordinator.executeSync() must be implemented')
  }

  /**
   * 取消同步作業
   * @param {string} syncId - 同步作業識別碼
   * @param {string} [reason] - 取消原因
   * @returns {Promise<Object>} 取消結果 { syncId, status, cancelledAt }
   */
  async cancelSync (syncId, reason = 'USER_CANCELLED') {
    throw new Error('ISynchronizationCoordinator.cancelSync() must be implemented')
  }

  /**
   * 獲取活躍的同步作業
   * @param {Object} [filter] - 篩選條件 { status, sourceType, priority }
   * @returns {Promise<Array<Object>>} 活躍同步作業列表
   */
  async getActiveSyncs (filter = {}) {
    throw new Error('ISynchronizationCoordinator.getActiveSyncs() must be implemented')
  }

  /**
   * 獲取同步作業狀態
   * @param {string} syncId - 同步作業識別碼
   * @returns {Promise<Object>} 狀態資訊 { syncId, status, progress, currentPhase }
   */
  async getSyncStatus (syncId) {
    throw new Error('ISynchronizationCoordinator.getSyncStatus() must be implemented')
  }

  /**
   * 獲取同步進度
   * @param {string} syncId - 同步作業識別碼
   * @returns {Promise<Object>} 進度資訊 { syncId, progress, eta, processedRecords }
   */
  async getSyncProgress (syncId) {
    throw new Error('ISynchronizationCoordinator.getSyncProgress() must be implemented')
  }

  /**
   * 獲取同步歷史記錄
   * @param {Object} [filter] - 篩選條件 { limit, status, dateRange, sourceType }
   * @returns {Promise<Array<Object>>} 歷史記錄列表
   */
  async getSyncHistory (filter = {}) {
    throw new Error('ISynchronizationCoordinator.getSyncHistory() must be implemented')
  }

  /**
   * 更新同步配置
   * @param {Object} config - 配置物件
   * @param {number} [config.maxConcurrentSyncs] - 最大並發同步數
   * @param {number} [config.syncInterval] - 同步間隔 (毫秒)
   * @param {number} [config.retryAttempts] - 重試次數
   * @param {number} [config.timeoutMs] - 超時時間
   * @returns {Promise<Object>} 更新結果 { updated, config }
   */
  async updateSyncConfig (config) {
    throw new Error('ISynchronizationCoordinator.updateSyncConfig() must be implemented')
  }

  /**
   * 獲取當前同步配置
   * @returns {Promise<Object>} 同步配置物件
   */
  async getSyncConfig () {
    throw new Error('ISynchronizationCoordinator.getSyncConfig() must be implemented')
  }

  /**
   * 獲取同步效能指標
   * @param {Object} [timeRange] - 時間範圍 { start, end }
   * @returns {Promise<Object>} 效能指標 { totalSyncs, successRate, avgDuration, throughput }
   */
  async getSyncMetrics (timeRange = {}) {
    throw new Error('ISynchronizationCoordinator.getSyncMetrics() must be implemented')
  }

  /**
   * 啟動同步協調器
   * @param {Object} [options] - 啟動選項 { skipValidation, restoreState }
   * @returns {Promise<Object>} 啟動結果 { status, startedAt }
   */
  async start (options = {}) {
    throw new Error('ISynchronizationCoordinator.start() must be implemented')
  }

  /**
   * 停止同步協調器
   * @param {Object} [options] - 停止選項 { graceful, timeout }
   * @returns {Promise<Object>} 停止結果 { status, stoppedAt }
   */
  async stop (options = {}) {
    throw new Error('ISynchronizationCoordinator.stop() must be implemented')
  }

  /**
   * 重啟同步協調器
   * @param {Object} [options] - 重啟選項 { preserveJobs, cleanState }
   * @returns {Promise<Object>} 重啟結果 { status, restartedAt }
   */
  async restart (options = {}) {
    throw new Error('ISynchronizationCoordinator.restart() must be implemented')
  }
}

/**
 * 同步協調器標準錯誤類型
 */
ISynchronizationCoordinator.ErrorTypes = {
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  NETWORK_ERROR: 'NETWORK_ERROR',
  CONFLICT_ERROR: 'CONFLICT_ERROR',
  PERMISSION_ERROR: 'PERMISSION_ERROR',
  SYSTEM_ERROR: 'SYSTEM_ERROR'
}

/**
 * 同步狀態枚舉
 */
ISynchronizationCoordinator.SyncStatus = {
  PENDING: 'PENDING',
  INITIALIZING: 'INITIALIZING',
  RUNNING: 'RUNNING',
  PAUSED: 'PAUSED',
  COMPLETED: 'COMPLETED',
  CANCELLED: 'CANCELLED',
  FAILED: 'FAILED'
}

/**
 * 同步策略枚舉
 */
ISynchronizationCoordinator.SyncStrategy = {
  SMART_MERGE: 'SMART_MERGE',
  SOURCE_OVERWRITE: 'SOURCE_OVERWRITE',
  APPEND_ONLY: 'APPEND_ONLY',
  MANUAL_RESOLUTION: 'MANUAL_RESOLUTION'
}

// 導出模組
if (typeof module !== 'undefined' && module.exports) {
  module.exports = ISynchronizationCoordinator
}

// 瀏覽器環境支援
if (typeof window !== 'undefined') {
  window.ISynchronizationCoordinator = ISynchronizationCoordinator
}
