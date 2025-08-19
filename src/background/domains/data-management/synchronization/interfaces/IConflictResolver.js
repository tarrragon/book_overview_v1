/**
 * IConflictResolver - 衝突解決器抽象介面
 *
 * 負責功能：
 * - 定義資料衝突檢測的標準介面契約
 * - 統一衝突解決策略的方法規範
 * - 建立解決結果驗證的抽象標準
 * - 提供批次衝突處理的接口定義
 *
 * 設計考量：
 * - 策略模式：支援多種解決策略的抽象化
 * - 智能分析：自動檢測和分類不同類型的衝突
 * - 批次處理：高效處理大量衝突的能力
 * - 結果追蹤：完整記錄解決過程和結果
 *
 * 處理流程：
 * 1. 檢測和分類資料衝突
 * 2. 分析衝突嚴重性和影響範圍
 * 3. 應用適當的解決策略
 * 4. 驗證解決結果的正確性
 * 5. 記錄解決歷史和統計資訊
 *
 * 使用情境：
 * - 作為所有衝突解決器實作類的基礎介面
 * - 資料同步系統中的衝突處理核心組件
 * - 多用戶協作環境的衝突管理工具
 * - 資料一致性保證的關鍵機制
 *
 * @version 1.0.0
 * @since 2025-08-19
 */

/**
 * 衝突解決器抽象介面
 * @interface IConflictResolver
 */
class IConflictResolver {
  /**
   * 檢測資料衝突
   * @param {Array<Object>} changes - 待檢測的變更列表
   * @param {Object} existingData - 現有資料
   * @param {Object} [options] - 檢測選項 { sensitivity, includeMetadata, autoClassify }
   * @returns {Promise<Array<Object>>} 衝突列表 [{ conflictId, type, severity, details }]
   */
  async detectConflicts (changes, existingData, options = {}) {
    throw new Error('IConflictResolver.detectConflicts() must be implemented')
  }

  /**
   * 識別衝突類型
   * @param {Object} conflict - 衝突物件
   * @param {Object} [context] - 上下文資訊 { metadata, relatedData }
   * @returns {Promise<Object>} 衝突類型分析 { primaryType, subTypes, characteristics }
   */
  async identifyConflictTypes (conflict, context = {}) {
    throw new Error('IConflictResolver.identifyConflictTypes() must be implemented')
  }

  /**
   * 分析衝突嚴重性
   * @param {Array<Object>} conflicts - 衝突列表
   * @param {Object} [criteria] - 評估標準 { businessRules, impactWeights }
   * @returns {Promise<Object>} 嚴重性分析 { critical, high, medium, low, info }
   */
  async analyzeConflictSeverity (conflicts, criteria = {}) {
    throw new Error('IConflictResolver.analyzeConflictSeverity() must be implemented')
  }

  /**
   * 解決衝突
   * @param {Array<Object>} conflicts - 衝突列表
   * @param {string|Object} strategy - 解決策略或策略配置
   * @param {Object} [options] - 解決選項 { autoApply, validateResult }
   * @returns {Promise<Array<Object>>} 解決結果列表 [{ resolutionId, conflictId, strategy, resolvedValue }]
   */
  async resolveConflicts (conflicts, strategy, options = {}) {
    throw new Error('IConflictResolver.resolveConflicts() must be implemented')
  }

  /**
   * 應用衝突解決方案
   * @param {Object} resolution - 解決方案
   * @param {string} resolution.resolutionId - 解決方案 ID
   * @param {string} resolution.conflictId - 關聯的衝突 ID
   * @param {*} resolution.resolvedValue - 解決後的值
   * @param {Object} [options] - 應用選項 { backup, validateFirst }
   * @returns {Promise<Object>} 應用結果 { applied, resolutionId, appliedAt }
   */
  async applyResolution (resolution, options = {}) {
    throw new Error('IConflictResolver.applyResolution() must be implemented')
  }

  /**
   * 驗證解決結果
   * @param {Object} resolvedData - 解決後的資料
   * @param {Object} [validationRules] - 驗證規則 { consistency, integrity, businessRules }
   * @returns {Promise<Object>} 驗證結果 { isValid, issues, validatedFields }
   */
  async validateResolution (resolvedData, validationRules = {}) {
    throw new Error('IConflictResolver.validateResolution() must be implemented')
  }

  /**
   * 設定解決策略
   * @param {Object} strategyConfig - 策略配置
   * @param {string} strategyConfig.defaultStrategy - 預設策略
   * @param {Object} [strategyConfig.fieldStrategies] - 欄位特定策略
   * @param {boolean} [strategyConfig.autoResolve] - 是否自動解決
   * @returns {Promise<Object>} 設定結果 { updated, config }
   */
  async setResolutionStrategy (strategyConfig) {
    throw new Error('IConflictResolver.setResolutionStrategy() must be implemented')
  }

  /**
   * 獲取當前解決策略
   * @returns {Promise<Object>} 當前策略配置
   */
  async getResolutionStrategy () {
    throw new Error('IConflictResolver.getResolutionStrategy() must be implemented')
  }

  /**
   * 批次解決衝突
   * @param {Array<Object>} conflictBatch - 衝突批次
   * @param {Object} batchStrategy - 批次策略配置
   * @param {string} batchStrategy.defaultStrategy - 預設解決策略
   * @param {number} [batchStrategy.maxBatchSize] - 最大批次大小
   * @param {Function} [batchStrategy.progressCallback] - 進度回調
   * @returns {Promise<Object>} 批次處理結果 { batchId, totalConflicts, resolved, failed }
   */
  async resolveBatchConflicts (conflictBatch, batchStrategy) {
    throw new Error('IConflictResolver.resolveBatchConflicts() must be implemented')
  }

  /**
   * 獲取批次解決進度
   * @param {string} batchId - 批次識別碼
   * @returns {Promise<Object>} 進度資訊 { batchId, progress, status, resolved, remaining }
   */
  async getBatchResolutionProgress (batchId) {
    throw new Error('IConflictResolver.getBatchResolutionProgress() must be implemented')
  }

  /**
   * 獲取解決歷史
   * @param {Object} [filter] - 篩選條件 { dateRange, strategy, conflictType, limit }
   * @returns {Promise<Array<Object>>} 歷史記錄列表
   */
  async getResolutionHistory (filter = {}) {
    throw new Error('IConflictResolver.getResolutionHistory() must be implemented')
  }

  /**
   * 獲取解決統計資訊
   * @param {Object} [timeRange] - 時間範圍 { start, end }
   * @returns {Promise<Object>} 統計資訊 { totalResolutions, successRate, avgResolutionTime, strategyUsage }
   */
  async getResolutionStatistics (timeRange = {}) {
    throw new Error('IConflictResolver.getResolutionStatistics() must be implemented')
  }

  /**
   * 清理解決歷史
   * @param {Object} [criteria] - 清理標準 { olderThan, status, maxRecords }
   * @returns {Promise<Object>} 清理結果 { cleaned, remaining }
   */
  async cleanupResolutionHistory (criteria = {}) {
    throw new Error('IConflictResolver.cleanupResolutionHistory() must be implemented')
  }
}

/**
 * 衝突類型枚舉
 */
IConflictResolver.ConflictTypes = {
  VALUE_CONFLICT: 'VALUE_CONFLICT',
  DELETE_UPDATE_CONFLICT: 'DELETE_UPDATE_CONFLICT',
  CREATE_CONFLICT: 'CREATE_CONFLICT',
  SCHEMA_CONFLICT: 'SCHEMA_CONFLICT',
  PERMISSION_CONFLICT: 'PERMISSION_CONFLICT'
}

/**
 * 嚴重性等級枚舉
 */
IConflictResolver.SeverityLevels = {
  CRITICAL: 'CRITICAL',
  HIGH: 'HIGH',
  MEDIUM: 'MEDIUM',
  LOW: 'LOW',
  INFO: 'INFO'
}

/**
 * 解決策略枚舉
 */
IConflictResolver.ResolutionStrategies = {
  LOCAL_WINS: 'LOCAL_WINS',
  REMOTE_WINS: 'REMOTE_WINS',
  TIMESTAMP_WINS: 'TIMESTAMP_WINS',
  MERGE: 'MERGE',
  MANUAL: 'MANUAL'
}

/**
 * 標準衝突結果格式
 */
IConflictResolver.StandardConflictFormat = {
  conflictId: '',
  type: '',
  severity: '',
  field: '',
  localValue: null,
  remoteValue: null,
  suggestedResolution: null,
  metadata: {
    detectedAt: 0,
    confidence: 1.0,
    autoResolvable: false
  }
}

/**
 * 標準解決記錄格式
 */
IConflictResolver.StandardResolutionFormat = {
  resolutionId: '',
  conflictId: '',
  strategy: '',
  resolvedValue: null,
  confidence: 1.0,
  appliedAt: 0,
  validationResult: {
    isValid: false,
    issues: []
  }
}

// 導出模組
if (typeof module !== 'undefined' && module.exports) {
  module.exports = IConflictResolver
}

// 瀏覽器環境支援
if (typeof window !== 'undefined') {
  window.IConflictResolver = IConflictResolver
}