/**
 * IDataComparator - 資料比較器抽象介面
 *
 * 負責功能：
 * - 定義資料差異計算的標準介面契約
 * - 統一變更檢測和比較策略的方法規範
 * - 建立差異分析和結果格式的抽象標準
 * - 提供高效能資料比較的接口定義
 *
 * 設計考量：
 * - 策略模式：支援多種比較策略的抽象化
 * - 效能優化：支援批次處理和快取機制
 * - 精確性：提供多層級的差異檢測能力
 * - 可配置性：比較行為可透過配置調整
 *
 * 處理流程：
 * 1. 設定資料比較策略和配置
 * 2. 執行資料差異計算和變更識別
 * 3. 生成標準化的變更集合
 * 4. 提供深度分析和驗證功能
 * 5. 支援批次處理和效能優化
 *
 * 使用情境：
 * - 作為所有資料比較器實作類的基礎介面
 * - 同步系統中的差異計算核心組件
 * - 資料一致性檢查和驗證工具
 * - 增量更新和變更追蹤系統
 *
 * @version 1.0.0
 * @since 2025-08-19
 */

/**
 * 資料比較器抽象介面
 * @interface IDataComparator
 */
class IDataComparator {
  /**
   * 計算兩組資料間的差異
   * @param {Object} sourceData - 來源資料
   * @param {Object} targetData - 目標資料
   * @param {Object} [options] - 比較選項 { strategy, ignoreFields, strictMode }
   * @returns {Promise<Object>} 差異結果 { summary, details, metadata }
   */
  async calculateDifferences (sourceData, targetData, options = {}) {
    throw new Error('IDataComparator.calculateDifferences() must be implemented')
  }

  /**
   * 識別資料項目的變更
   * @param {Object} newData - 新資料項目
   * @param {Object} existingData - 現有資料項目
   * @param {Object} [options] - 識別選項 { fieldLevel, includeMetadata }
   * @returns {Promise<Array<Object>>} 變更列表 [{ id, type, field, oldValue, newValue }]
   */
  async identifyChanges (newData, existingData, options = {}) {
    throw new Error('IDataComparator.identifyChanges() must be implemented')
  }

  /**
   * 基於差異生成變更集
   * @param {Object} differences - 差異分析結果
   * @param {Object} [options] - 生成選項 { includeReversible, addTimestamp }
   * @returns {Promise<Object>} 變更集 { changeSetId, timestamp, changes, metadata }
   */
  async generateChangeSet (differences, options = {}) {
    throw new Error('IDataComparator.generateChangeSet() must be implemented')
  }

  /**
   * 設定比較策略
   * @param {Object} strategy - 比較策略配置
   * @param {string} strategy.type - 策略類型 ('FIELD_LEVEL', 'OBJECT_LEVEL', 'DEEP_COMPARE', 'HASH_COMPARE')
   * @param {Array<string>} [strategy.ignoreFields] - 忽略的欄位列表
   * @param {boolean} [strategy.strictMode] - 嚴格模式
   * @param {Object} [strategy.customRules] - 自訂比較規則
   * @returns {Promise<Object>} 設定結果 { updated, strategy }
   */
  async setComparisonStrategy (strategy) {
    throw new Error('IDataComparator.setComparisonStrategy() must be implemented')
  }

  /**
   * 獲取當前比較策略
   * @returns {Promise<Object>} 當前策略配置
   */
  async getComparisonStrategy () {
    throw new Error('IDataComparator.getComparisonStrategy() must be implemented')
  }

  /**
   * 啟用批次比較功能
   * @param {Object} batchConfig - 批次配置
   * @param {number} batchConfig.batchSize - 批次大小
   * @param {number} [batchConfig.concurrency] - 併發數
   * @param {Function} [batchConfig.progressCallback] - 進度回調
   * @returns {Promise<Object>} 啟用結果 { enabled, config }
   */
  async enableBatchComparison (batchConfig) {
    throw new Error('IDataComparator.enableBatchComparison() must be implemented')
  }

  /**
   * 設定比較快取
   * @param {Object} cacheConfig - 快取配置
   * @param {boolean} cacheConfig.enabled - 是否啟用
   * @param {number} [cacheConfig.maxSize] - 最大快取大小
   * @param {number} [cacheConfig.ttl] - 生存時間 (毫秒)
   * @returns {Promise<Object>} 快取設定結果 { configured, config }
   */
  async setComparisonCache (cacheConfig) {
    throw new Error('IDataComparator.setComparisonCache() must be implemented')
  }

  /**
   * 分析資料結構
   * @param {Object} data - 要分析的資料
   * @param {Object} [options] - 分析選項 { deep, includeTypes, includeStats }
   * @returns {Promise<Object>} 結構分析結果 { schema, totalRecords, analysisTime, complexity }
   */
  async analyzeDataStructure (data, options = {}) {
    throw new Error('IDataComparator.analyzeDataStructure() must be implemented')
  }

  /**
   * 驗證資料完整性
   * @param {Object} data - 要驗證的資料
   * @param {Object} [criteria] - 驗證標準 { requiredFields, dataTypes, constraints }
   * @returns {Promise<Object>} 驗證結果 { isValid, issues, validatedRecords }
   */
  async validateDataIntegrity (data, criteria = {}) {
    throw new Error('IDataComparator.validateDataIntegrity() must be implemented')
  }

  /**
   * 計算資料相似度
   * @param {Object} data1 - 第一組資料
   * @param {Object} data2 - 第二組資料
   * @param {Object} [options] - 計算選項 { algorithm, weights, threshold }
   * @returns {Promise<Object>} 相似度結果 { similarity, confidence, details }
   */
  async calculateSimilarity (data1, data2, options = {}) {
    throw new Error('IDataComparator.calculateSimilarity() must be implemented')
  }

  /**
   * 獲取比較統計資訊
   * @param {Object} [timeRange] - 時間範圍 { start, end }
   * @returns {Promise<Object>} 統計資訊 { totalComparisons, avgComparisonTime, cacheHitRate }
   */
  async getComparisonStatistics (timeRange = {}) {
    throw new Error('IDataComparator.getComparisonStatistics() must be implemented')
  }
}

/**
 * 差異類型枚舉
 */
IDataComparator.DifferenceTypes = {
  ADDED: 'ADDED',
  UPDATED: 'UPDATED',
  REMOVED: 'REMOVED',
  MOVED: 'MOVED',
  RENAMED: 'RENAMED'
}

/**
 * 嚴重性等級枚舉
 */
IDataComparator.SeverityLevels = {
  CRITICAL: 'CRITICAL',
  MAJOR: 'MAJOR',
  MINOR: 'MINOR',
  COSMETIC: 'COSMETIC'
}

/**
 * 比較策略類型枚舉
 */
IDataComparator.StrategyTypes = {
  FIELD_LEVEL: 'FIELD_LEVEL',
  OBJECT_LEVEL: 'OBJECT_LEVEL', 
  DEEP_COMPARE: 'DEEP_COMPARE',
  HASH_COMPARE: 'HASH_COMPARE'
}

/**
 * 標準差異結果格式
 */
IDataComparator.StandardDifferenceFormat = {
  summary: {
    totalChanges: 0,
    addedCount: 0,
    updatedCount: 0,
    removedCount: 0
  },
  details: {
    added: [],
    updated: [],
    removed: []
  },
  metadata: {
    comparisonTime: 0,
    strategy: '',
    confidence: 1.0
  }
}

/**
 * 標準變更項目格式
 */
IDataComparator.StandardChangeFormat = {
  id: '',
  type: '',
  field: '',
  oldValue: null,
  newValue: null,
  severity: '',
  timestamp: 0,
  confidence: 1.0
}

// 導出模組
if (typeof module !== 'undefined' && module.exports) {
  module.exports = IDataComparator
}

// 瀏覽器環境支援
if (typeof window !== 'undefined') {
  window.IDataComparator = IDataComparator
}