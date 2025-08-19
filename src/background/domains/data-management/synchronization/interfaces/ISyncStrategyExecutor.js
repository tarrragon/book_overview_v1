/**
 * ISyncStrategyExecutor - 同步策略執行器抽象介面
 *
 * 負責功能：
 * - 定義同步策略執行的標準介面契約
 * - 統一不同同步策略的執行方法規範
 * - 建立策略配置和參數化的抽象標準
 * - 提供策略執行監控和統計的接口定義
 *
 * 設計考量：
 * - 策略模式：支援多種同步策略的抽象執行
 * - 可配置性：策略行為可透過參數調整
 * - 監控能力：完整追蹤策略執行過程和效果
 * - 錯誤恢復：提供策略執行失敗的恢復機制
 *
 * 處理流程：
 * 1. 載入和配置指定的同步策略
 * 2. 準備策略執行的資料和環境
 * 3. 執行策略邏輯並監控進度
 * 4. 處理執行結果和異常情況
 * 5. 記錄執行統計和效能指標
 *
 * 使用情境：
 * - 作為所有同步策略執行器實作類的基礎介面
 * - 同步系統中策略執行的核心組件
 * - 多策略管理和動態策略選擇工具
 * - 策略效能分析和優化平台
 *
 * @version 1.0.0
 * @since 2025-08-19
 */

/**
 * 同步策略執行器抽象介面
 * @interface ISyncStrategyExecutor
 */
class ISyncStrategyExecutor {
  /**
   * 執行合併策略
   * @param {Object} sourceData - 來源資料
   * @param {Object} targetData - 目標資料
   * @param {Object} [options] - 執行選項 { conflictResolution, mergeRules, priority }
   * @returns {Promise<Object>} 合併結果 { mergedData, conflicts, statistics }
   */
  async executeMergeStrategy (sourceData, targetData, options = {}) {
    throw new Error('ISyncStrategyExecutor.executeMergeStrategy() must be implemented')
  }

  /**
   * 執行覆寫策略
   * @param {Object} sourceData - 來源資料
   * @param {Object} targetData - 目標資料
   * @param {Object} [options] - 執行選項 { direction, backup, preserveFields }
   * @returns {Promise<Object>} 覆寫結果 { overwrittenData, backup, statistics }
   */
  async executeOverwriteStrategy (sourceData, targetData, options = {}) {
    throw new Error('ISyncStrategyExecutor.executeOverwriteStrategy() must be implemented')
  }

  /**
   * 執行附加策略
   * @param {Object} sourceData - 來源資料
   * @param {Object} targetData - 目標資料
   * @param {Object} [options] - 執行選項 { appendMode, duplicateHandling, ordering }
   * @returns {Promise<Object>} 附加結果 { appendedData, duplicates, statistics }
   */
  async executeAppendStrategy (sourceData, targetData, options = {}) {
    throw new Error('ISyncStrategyExecutor.executeAppendStrategy() must be implemented')
  }

  /**
   * 執行自訂策略
   * @param {string} strategyName - 策略名稱
   * @param {Object} sourceData - 來源資料
   * @param {Object} targetData - 目標資料
   * @param {Object} [strategyConfig] - 策略配置
   * @returns {Promise<Object>} 執行結果 { processedData, metadata, statistics }
   */
  async executeCustomStrategy (strategyName, sourceData, targetData, strategyConfig = {}) {
    throw new Error('ISyncStrategyExecutor.executeCustomStrategy() must be implemented')
  }

  /**
   * 註冊自訂策略
   * @param {string} strategyName - 策略名稱
   * @param {Function} strategyFunction - 策略執行函數
   * @param {Object} [metadata] - 策略元資料 { description, parameters, version }
   * @returns {Promise<Object>} 註冊結果 { registered, strategyName, metadata }
   */
  async registerCustomStrategy (strategyName, strategyFunction, metadata = {}) {
    throw new Error('ISyncStrategyExecutor.registerCustomStrategy() must be implemented')
  }

  /**
   * 取消註冊自訂策略
   * @param {string} strategyName - 策略名稱
   * @returns {Promise<Object>} 取消註冊結果 { unregistered, strategyName }
   */
  async unregisterCustomStrategy (strategyName) {
    throw new Error('ISyncStrategyExecutor.unregisterCustomStrategy() must be implemented')
  }

  /**
   * 獲取可用策略列表
   * @param {Object} [filter] - 篩選條件 { category, version, capability }
   * @returns {Promise<Array<Object>>} 策略列表 [{ name, description, parameters, metadata }]
   */
  async getAvailableStrategies (filter = {}) {
    throw new Error('ISyncStrategyExecutor.getAvailableStrategies() must be implemented')
  }

  /**
   * 驗證策略相容性
   * @param {string} strategyName - 策略名稱
   * @param {Object} dataSchema - 資料架構
   * @param {Object} [requirements] - 相容性要求
   * @returns {Promise<Object>} 相容性結果 { compatible, issues, recommendations }
   */
  async validateStrategyCompatibility (strategyName, dataSchema, requirements = {}) {
    throw new Error('ISyncStrategyExecutor.validateStrategyCompatibility() must be implemented')
  }

  /**
   * 預覽策略執行效果
   * @param {string} strategyName - 策略名稱
   * @param {Object} sourceData - 來源資料
   * @param {Object} targetData - 目標資料
   * @param {Object} [options] - 預覽選項 { sampleSize, includeDetails }
   * @returns {Promise<Object>} 預覽結果 { preview, impact, recommendations }
   */
  async previewStrategyExecution (strategyName, sourceData, targetData, options = {}) {
    throw new Error('ISyncStrategyExecutor.previewStrategyExecution() must be implemented')
  }

  /**
   * 批次執行策略
   * @param {Array<Object>} executionBatch - 執行批次 [{ strategy, sourceData, targetData, options }]
   * @param {Object} [batchOptions] - 批次選項 { concurrency, failureMode, progressCallback }
   * @returns {Promise<Object>} 批次執行結果 { batchId, results, failed, statistics }
   */
  async executeBatchStrategies (executionBatch, batchOptions = {}) {
    throw new Error('ISyncStrategyExecutor.executeBatchStrategies() must be implemented')
  }

  /**
   * 回滾策略執行
   * @param {string} executionId - 執行識別碼
   * @param {Object} [rollbackOptions] - 回滾選項 { validateBackup, partialRollback }
   * @returns {Promise<Object>} 回滾結果 { rolledBack, executionId, restoredData }
   */
  async rollbackStrategyExecution (executionId, rollbackOptions = {}) {
    throw new Error('ISyncStrategyExecutor.rollbackStrategyExecution() must be implemented')
  }

  /**
   * 獲取策略執行歷史
   * @param {Object} [filter] - 篩選條件 { strategy, dateRange, status, limit }
   * @returns {Promise<Array<Object>>} 執行歷史列表
   */
  async getStrategyExecutionHistory (filter = {}) {
    throw new Error('ISyncStrategyExecutor.getStrategyExecutionHistory() must be implemented')
  }

  /**
   * 獲取策略執行統計
   * @param {Object} [timeRange] - 時間範圍 { start, end }
   * @returns {Promise<Object>} 統計資訊 { totalExecutions, successRate, avgExecutionTime, popularStrategies }
   */
  async getStrategyExecutionStatistics (timeRange = {}) {
    throw new Error('ISyncStrategyExecutor.getStrategyExecutionStatistics() must be implemented')
  }

  /**
   * 優化策略配置
   * @param {string} strategyName - 策略名稱
   * @param {Object} performanceData - 效能資料
   * @param {Object} [optimizationGoals] - 優化目標 { speed, accuracy, memoryUsage }
   * @returns {Promise<Object>} 優化建議 { recommendations, estimatedImprovement, config }
   */
  async optimizeStrategyConfiguration (strategyName, performanceData, optimizationGoals = {}) {
    throw new Error('ISyncStrategyExecutor.optimizeStrategyConfiguration() must be implemented')
  }
}

/**
 * 策略類型枚舉
 */
ISyncStrategyExecutor.StrategyTypes = {
  MERGE: 'MERGE',
  OVERWRITE: 'OVERWRITE',
  APPEND: 'APPEND',
  CUSTOM: 'CUSTOM'
}

/**
 * 執行狀態枚舉
 */
ISyncStrategyExecutor.ExecutionStatus = {
  PENDING: 'PENDING',
  RUNNING: 'RUNNING',
  COMPLETED: 'COMPLETED',
  FAILED: 'FAILED',
  CANCELLED: 'CANCELLED',
  ROLLED_BACK: 'ROLLED_BACK'
}

/**
 * 衝突解決模式枚舉
 */
ISyncStrategyExecutor.ConflictResolutionModes = {
  AUTO_RESOLVE: 'AUTO_RESOLVE',
  MANUAL_REVIEW: 'MANUAL_REVIEW',
  SKIP_CONFLICTS: 'SKIP_CONFLICTS',
  FAIL_ON_CONFLICT: 'FAIL_ON_CONFLICT'
}

/**
 * 標準策略執行結果格式
 */
ISyncStrategyExecutor.StandardExecutionResult = {
  executionId: '',
  strategy: '',
  status: '',
  startTime: 0,
  endTime: 0,
  processedRecords: 0,
  conflicts: 0,
  errors: [],
  statistics: {
    executionTime: 0,
    memoryUsage: 0,
    successRate: 1.0
  }
}

/**
 * 標準策略元資料格式
 */
ISyncStrategyExecutor.StandardStrategyMetadata = {
  name: '',
  description: '',
  version: '',
  category: '',
  parameters: {},
  capabilities: [],
  requirements: {
    dataTypes: [],
    minDataSize: 0,
    maxDataSize: 0
  }
}

// 導出模組
if (typeof module !== 'undefined' && module.exports) {
  module.exports = ISyncStrategyExecutor
}

// 瀏覽器環境支援
if (typeof window !== 'undefined') {
  window.ISyncStrategyExecutor = ISyncStrategyExecutor
}