/**
 * @fileoverview DataComparisonEngine - 高效能資料比較和差異計算引擎
 * @version 1.0.0
 * @since 2025-08-19
 *
 * 負責功能：
 * - 高效能的資料比較演算法
 * - 資料差異計算和變更檢測
 * - 最佳化的欄位比較和型別檢查
 * - 變更嚴重性分析和統計
 *
 * 設計考量：
 * - 從 data-synchronization-service.js 拆分的核心比較邏輯
 * - 保持原有的效能最佳化和容錯機制
 * - 支援 Readmoo 特定的資料格式和欄位
 * - 提供清晰的比較結果和統計資訊
 *
 * 處理流程：
 * 1. 接收源資料和目標資料
 * 2. 執行最佳化的資料比較演算法
 * 3. 計算具體的欄位差異和變更類型
 * 4. 分析變更嚴重性和影響範圍
 * 5. 回傳結構化的比較結果
 *
 * 使用情境：
 * - ReadmooSynchronizationCoordinator 的核心依賴
 * - 增量同步的資料差異計算
 * - 資料一致性檢查和驗證
 * - 同步效能分析和最佳化
 */

class DataComparisonEngine {
  /**
   * 建構資料比較引擎
   * @param {Object} options - 比較選項配置
   */
  constructor (options = {}) {
    // 比較配置
    this.config = {
      compareFields: options.compareFields || ['title', 'progress', 'lastUpdated'],
      caseSensitive: options.caseSensitive !== false, // 預設區分大小寫
      numericTolerance: options.numericTolerance || 0,
      enableOptimizedCompare: options.enableOptimizedCompare !== false,
      batchSize: options.batchSize || 100,
      ...options
    }

    // 效能統計
    this.stats = {
      totalComparisons: 0,
      optimizedComparisons: 0,
      totalProcessingTime: 0,
      averageComparisonTime: 0
    }

    // 初始化
    this.isInitialized = true
  }

  /**
   * 計算資料差異
   * @param {Array} sourceData - 源資料陣列
   * @param {Array} targetData - 目標資料陣列
   * @returns {Promise<Object>} 差異結果物件
   */
  async calculateDataDifferences (sourceData, targetData) {
    const startTime = Date.now()

    try {
      // 資料驗證
      if (!Array.isArray(sourceData) || !Array.isArray(targetData)) {
        throw new Error('Source and target data must be arrays')
      }

      // 建立目標資料的快速查找表
      const targetMap = new Map()
      for (const item of targetData) {
        if (item && item.id) {
          targetMap.set(item.id, item)
        }
      }

      const changes = {
        added: [],
        modified: [],
        deleted: [],
        unchanged: []
      }

      // 找出新增和修改的項目
      for (const sourceItem of sourceData) {
        if (!sourceItem || !sourceItem.id) {
          continue // 跳過無效項目
        }

        const targetItem = targetMap.get(sourceItem.id)

        if (!targetItem) {
          // 新增的項目
          changes.added.push({
            id: sourceItem.id,
            data: sourceItem
          })
        } else {
          // 檢查是否有變更
          const hasChanges = this.config.enableOptimizedCompare
            ? this.compareBookDataOptimized(sourceItem, targetItem)
            : this.compareBookData(sourceItem, targetItem)

          if (hasChanges) {
            changes.modified.push({
              id: sourceItem.id,
              sourceData: sourceItem,
              targetData: targetItem,
              fieldChanges: this.getFieldChanges(sourceItem, targetItem)
            })
          } else {
            changes.unchanged.push({
              id: sourceItem.id,
              data: sourceItem
            })
          }
        }
      }

      // 找出被刪除的項目
      const sourceIds = new Set(sourceData.filter(item => item && item.id).map(item => item.id))
      for (const targetItem of targetData) {
        if (targetItem && targetItem.id && !sourceIds.has(targetItem.id)) {
          changes.deleted.push({
            id: targetItem.id,
            data: targetItem
          })
        }
      }

      // 更新統計
      this.stats.totalComparisons++
      const processingTime = Date.now() - startTime
      this.stats.totalProcessingTime += processingTime
      this.stats.averageComparisonTime = this.stats.totalProcessingTime / this.stats.totalComparisons

      return {
        changes,
        summary: {
          added: changes.added.length,
          modified: changes.modified.length,
          deleted: changes.deleted.length,
          unchanged: changes.unchanged.length,
          total: sourceData.length + targetData.length - changes.unchanged.length
        },
        processingTime,
        timestamp: Date.now()
      }
    } catch (error) {
      throw new Error(`Data comparison failed: ${error.message}`)
    }
  }

  /**
   * 最佳化的書籍資料比較（效能優先）
   * @param {Object} source - 源資料
   * @param {Object} target - 目標資料
   * @returns {boolean} 是否有差異
   */
  compareBookDataOptimized (source, target) {
    const { compareFields, caseSensitive, numericTolerance } = this.config

    // 快速路徑：完全相同的物件
    if (source === target) return false

    // 逐欄位比較，一旦發現差異立即回傳
    for (let i = 0; i < compareFields.length; i++) {
      const field = compareFields[i]
      const sourceValue = source[field]
      const targetValue = target[field]

      // 快速相等檢查
      if (sourceValue === targetValue) continue

      // 字串比較（大小寫敏感度設定）
      if (typeof sourceValue === 'string' && typeof targetValue === 'string') {
        if (!caseSensitive) {
          if (sourceValue.toLowerCase() !== targetValue.toLowerCase()) return true
        } else {
          if (sourceValue !== targetValue) return true
        }
      }
      // 數值比較（容錯度設定）
      else if (typeof sourceValue === 'number' && typeof targetValue === 'number') {
        if (Math.abs(sourceValue - targetValue) > numericTolerance) return true
      }
      // 其他類型的嚴格比較
      else {
        if (sourceValue !== targetValue) return true
      }
    }

    this.stats.optimizedComparisons++
    return false
  }

  /**
   * 標準書籍資料比較（詳細分析）
   * @param {Object} source - 源資料
   * @param {Object} target - 目標資料
   * @returns {boolean} 是否有差異
   */
  compareBookData (source, target) {
    // 快速路徑
    if (source === target) return false
    if (!source || !target) return true

    const fieldChanges = this.getFieldChanges(source, target)
    return Object.keys(fieldChanges).length > 0
  }

  /**
   * 獲取欄位變更詳情
   * @param {Object} source - 源資料
   * @param {Object} target - 目標資料
   * @returns {Object} 欄位變更物件
   */
  getFieldChanges (source, target) {
    const changes = {}
    const { compareFields } = this.config

    for (const field of compareFields) {
      const sourceValue = source[field]
      const targetValue = target[field]

      // 跳過相同值
      if (sourceValue === targetValue) {
        continue
      }

      // 字串大小寫不敏感比較
      if (typeof sourceValue === 'string' && typeof targetValue === 'string') {
        if (!this.config.caseSensitive) {
          if (sourceValue.toLowerCase() === targetValue.toLowerCase()) {
            continue
          }
        }
      }

      // 記錄有變更的欄位
      const hasChange = sourceValue !== targetValue
      if (hasChange) {
        changes[field] = {
          source: sourceValue,
          target: targetValue,
          type: this.getChangeType(sourceValue, targetValue),
          severity: this.calculateChangeSeverity(field, sourceValue, targetValue)
        }
      }
    }

    return changes
  }

  /**
   * 獲取變更類型
   * @param {*} sourceValue - 源值
   * @param {*} targetValue - 目標值
   * @returns {string} 變更類型
   */
  getChangeType (sourceValue, targetValue) {
    if (targetValue === null || targetValue === undefined) return 'ADDED'
    if (sourceValue === null || sourceValue === undefined) return 'REMOVED'
    if (typeof sourceValue !== typeof targetValue) return 'TYPE_CHANGED'

    if (typeof sourceValue === 'number') {
      return Math.abs(sourceValue - targetValue) > this.config.numericTolerance ? 'VALUE_CHANGED' : 'MINOR_CHANGE'
    }

    return 'VALUE_CHANGED'
  }

  /**
   * 計算變更嚴重性
   * @param {string} field - 欄位名稱
   * @param {*} sourceValue - 源值
   * @param {*} targetValue - 目標值
   * @returns {string} 嚴重性等級
   */
  calculateChangeSeverity (field, sourceValue, targetValue) {
    // 進度變更的嚴重性分析
    if (field === 'progress') {
      const diff = Math.abs(sourceValue - targetValue)
      if (diff >= 50) return 'HIGH'
      if (diff >= 20) return 'MEDIUM'
      return 'LOW'
    }

    // 標題變更的嚴重性分析
    if (field === 'title') {
      if (!sourceValue || !targetValue) return 'HIGH'

      const similarity = this.calculateStringSimilarity(sourceValue, targetValue)
      if (similarity < 0.5) return 'HIGH'
      if (similarity < 0.8) return 'MEDIUM'
      return 'LOW'
    }

    // 預設嚴重性
    return 'MEDIUM'
  }

  /**
   * 計算字串相似度（Levenshtein距離）
   * @param {string} str1 - 字串1
   * @param {string} str2 - 字串2
   * @returns {number} 相似度（0-1之間）
   */
  calculateStringSimilarity (str1, str2) {
    if (!str1 || !str2) return 0
    if (str1 === str2) return 1

    const len1 = str1.length
    const len2 = str2.length
    const matrix = Array(len1 + 1).fill().map(() => Array(len2 + 1).fill(0))

    for (let i = 0; i <= len1; i++) matrix[i][0] = i
    for (let j = 0; j <= len2; j++) matrix[0][j] = j

    for (let i = 1; i <= len1; i++) {
      for (let j = 1; j <= len2; j++) {
        const cost = str1[i - 1] === str2[j - 1] ? 0 : 1
        matrix[i][j] = Math.min(
          matrix[i - 1][j] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j - 1] + cost
        )
      }
    }

    const maxLength = Math.max(len1, len2)
    return (maxLength - matrix[len1][len2]) / maxLength
  }

  /**
   * 批次處理大量資料比較
   * @param {Array} sourceData - 源資料
   * @param {Array} targetData - 目標資料
   * @returns {Promise<Object>} 批次比較結果
   */
  async processBatch (sourceData, targetData) {
    const { batchSize } = this.config
    const totalItems = Math.max(sourceData.length, targetData.length)
    const batches = Math.ceil(totalItems / batchSize)

    const aggregatedResults = {
      changes: { added: [], modified: [], deleted: [], unchanged: [] },
      summary: { added: 0, modified: 0, deleted: 0, unchanged: 0, total: 0 },
      processingTime: 0,
      batches
    }

    for (let i = 0; i < batches; i++) {
      const start = i * batchSize
      const end = start + batchSize

      const sourceBatch = sourceData.slice(start, end)
      const targetBatch = targetData.slice(start, end)

      const batchResult = await this.calculateDataDifferences(sourceBatch, targetBatch)

      // 合併結果
      aggregatedResults.changes.added.push(...batchResult.changes.added)
      aggregatedResults.changes.modified.push(...batchResult.changes.modified)
      aggregatedResults.changes.deleted.push(...batchResult.changes.deleted)
      aggregatedResults.changes.unchanged.push(...batchResult.changes.unchanged)

      aggregatedResults.summary.added += batchResult.summary.added
      aggregatedResults.summary.modified += batchResult.summary.modified
      aggregatedResults.summary.deleted += batchResult.summary.deleted
      aggregatedResults.summary.unchanged += batchResult.summary.unchanged

      aggregatedResults.processingTime += batchResult.processingTime
    }

    aggregatedResults.summary.total = aggregatedResults.summary.added +
                                      aggregatedResults.summary.modified +
                                      aggregatedResults.summary.deleted +
                                      aggregatedResults.summary.unchanged

    return aggregatedResults
  }

  /**
   * 獲取比較引擎統計
   * @returns {Object} 統計資訊
   */
  getStatistics () {
    return {
      ...this.stats,
      config: this.config,
      timestamp: Date.now()
    }
  }

  /**
   * 重置統計計數器
   */
  resetStatistics () {
    this.stats = {
      totalComparisons: 0,
      optimizedComparisons: 0,
      totalProcessingTime: 0,
      averageComparisonTime: 0
    }
  }

  /**
   * 更新比較配置
   * @param {Object} newConfig - 新的配置選項
   */
  updateConfig (newConfig) {
    this.config = {
      ...this.config,
      ...newConfig
    }
  }
}

// 導出模組
if (typeof module !== 'undefined' && module.exports) {
  module.exports = DataComparisonEngine
}

// 瀏覽器環境支援
if (typeof window !== 'undefined') {
  window.DataComparisonEngine = DataComparisonEngine
}
