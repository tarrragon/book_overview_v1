/**
 * DataDifferenceEngine - 資料差異計算引擎
 * TDD 循環 2: 純粹資料差異計算演算法實作
 *
 * 職責：
 * - 計算兩組資料間的差異
 * - 支援靈活的比較配置
 * - 提供詳細的變更分析
 * - 效能最佳化的差異計算
 *
 * TDD實作：根據測試驅動的最小可行實作
 */
class DataDifferenceEngine {
  constructor (config = {}) {
    // 預設配置
    this.config = {
      compareFields: ['title', 'progress', 'lastUpdated'],
      caseSensitive: true,
      numericTolerance: 0,
      ...config
    }

    // 統計資料
    this.stats = {
      totalCalculations: 0,
      totalChangesProcessed: 0,
      lastCalculation: null
    }
  }

  /**
   * 計算資料差異
   * @param {Array} sourceData - 源資料
   * @param {Array} targetData - 目標資料
   * @returns {Object} 差異結果
   */
  calculateDifferences (sourceData, targetData) {
    const startTime = performance.now()

    // 安全處理空資料
    const safeSource = this._sanitizeData(sourceData || [])
    const safeTarget = this._sanitizeData(targetData || [])

    const result = {
      added: [],
      modified: [],
      deleted: [],
      unchanged: [],
      summary: {}
    }

    // 建立目標資料索引
    const targetMap = new Map()
    for (const item of safeTarget) {
      if (item && item.id) {
        targetMap.set(item.id, item)
      }
    }

    // 建立源資料索引
    const sourceMap = new Map()
    for (const item of safeSource) {
      if (item && item.id) {
        sourceMap.set(item.id, item)
      }
    }

    // 檢查新增和修改
    for (const sourceItem of safeSource) {
      if (!sourceItem || !sourceItem.id) continue

      const targetItem = targetMap.get(sourceItem.id)
      if (!targetItem) {
        // 新增項目
        result.added.push(sourceItem)
      } else {
        // 比較項目
        if (this.compareItems(sourceItem, targetItem)) {
          // 修改項目
          result.modified.push({
            id: sourceItem.id,
            source: sourceItem,
            target: targetItem,
            changes: this.getFieldChanges(sourceItem, targetItem)
          })
        } else {
          // 未變更項目
          result.unchanged.push(sourceItem)
        }
      }
    }

    // 檢查刪除
    for (const targetItem of safeTarget) {
      if (!targetItem || !targetItem.id) continue

      if (!sourceMap.has(targetItem.id)) {
        result.deleted.push(targetItem)
      }
    }

    // 計算統計
    const calculationTime = performance.now() - startTime
    this.stats.totalCalculations++
    this.stats.totalChangesProcessed += result.added.length + result.modified.length + result.deleted.length

    // 記錄最後一次計算
    this.stats.lastCalculation = {
      sourceCount: safeSource.length,
      targetCount: safeTarget.length,
      addedCount: result.added.length,
      modifiedCount: result.modified.length,
      deletedCount: result.deleted.length,
      unchangedCount: result.unchanged.length,
      totalChanges: result.added.length + result.modified.length + result.deleted.length,
      calculationTime
    }

    result.summary = {
      addedCount: result.added.length,
      modifiedCount: result.modified.length,
      deletedCount: result.deleted.length,
      unchangedCount: result.unchanged.length,
      totalChanges: result.added.length + result.modified.length + result.deleted.length,
      calculationTime,
      timestamp: Date.now()
    }

    return result
  }

  /**
   * 比較兩個項目
   * @param {Object} source - 源項目
   * @param {Object} target - 目標項目
   * @returns {boolean} 是否有差異
   */
  compareItems (source, target) {
    if (!source || !target) return true

    for (const field of this.config.compareFields) {
      const sourceValue = source[field]
      const targetValue = target[field]

      if (this._compareFieldValues(sourceValue, targetValue)) {
        return true // 有差異
      }
    }

    return false // 沒有差異
  }

  /**
   * 獲取欄位變更詳情
   * @param {Object} source - 源項目
   * @param {Object} target - 目標項目
   * @returns {Object} 變更詳情
   */
  getFieldChanges (source, target) {
    const changes = {}

    for (const field of this.config.compareFields) {
      const sourceValue = source[field]
      const targetValue = target[field]

      if (this._compareFieldValues(sourceValue, targetValue)) {
        changes[field] = {
          from: targetValue,
          to: sourceValue,
          type: 'modified',
          severity: this._calculateChangeSeverity(field, sourceValue, targetValue)
        }
      }
    }

    return changes
  }

  /**
   * 比較欄位值
   * @param {*} sourceValue - 源值
   * @param {*} targetValue - 目標值
   * @returns {boolean} 是否有差異
   */
  _compareFieldValues (sourceValue, targetValue) {
    // 處理 null 和 undefined
    if (sourceValue == null && targetValue == null) return false
    if (sourceValue == null || targetValue == null) return true

    // 數字比較（支援容差）
    if (typeof sourceValue === 'number' && typeof targetValue === 'number') {
      return Math.abs(sourceValue - targetValue) > this.config.numericTolerance
    }

    // 字串比較（支援大小寫不敏感）
    if (typeof sourceValue === 'string' && typeof targetValue === 'string') {
      if (!this.config.caseSensitive) {
        return sourceValue.toLowerCase() !== targetValue.toLowerCase()
      }
      return sourceValue !== targetValue
    }

    // 其他類型直接比較
    return sourceValue !== targetValue
  }

  /**
   * 計算變更嚴重程度
   * @param {string} field - 欄位名稱
   * @param {*} sourceValue - 源值
   * @param {*} targetValue - 目標值
   * @returns {string} 嚴重程度
   */
  _calculateChangeSeverity (field, sourceValue, targetValue) {
    // 進度欄位特殊處理
    if (field === 'progress' && typeof sourceValue === 'number' && typeof targetValue === 'number') {
      const diff = Math.abs(sourceValue - targetValue)
      if (diff >= 50) return 'high'
      if (diff >= 25) return 'medium'
      return 'low'
    }

    // 標題欄位特殊處理
    if (field === 'title') {
      return 'medium' // 標題變更通常需要注意
    }

    // lastUpdated 和其他欄位預設為低嚴重程度
    if (field === 'lastUpdated') {
      return 'low'
    }

    // 預設低嚴重程度
    return 'low'
  }

  /**
   * 清理資料
   * @param {Array} data - 資料陣列
   * @returns {Array} 清理後的資料
   */
  _sanitizeData (data) {
    if (!Array.isArray(data)) return []

    return data.filter(item =>
      item !== null &&
      item !== undefined &&
      typeof item === 'object' &&
      item.id
    )
  }

  /**
   * 更新配置
   * @param {Object} newConfig - 新配置
   */
  updateConfig (newConfig) {
    this.config = { ...this.config, ...newConfig }
  }

  /**
   * 獲取配置
   * @returns {Object} 當前配置
   */
  getConfig () {
    return { ...this.config }
  }

  /**
   * 重置配置為預設值
   */
  resetConfig () {
    this.config = {
      compareFields: ['title', 'progress', 'lastUpdated'],
      caseSensitive: true,
      numericTolerance: 0
    }
  }

  /**
   * 獲取統計資訊
   * @returns {Object} 統計資訊
   */
  getStatistics () {
    return {
      totalCalculations: this.stats.totalCalculations,
      totalChangesProcessed: this.stats.totalChangesProcessed,
      lastCalculation: this.stats.lastCalculation
    }
  }

  /**
   * 清除統計
   */
  clearStatistics () {
    this.stats = {
      totalCalculations: 0,
      totalChangesProcessed: 0,
      lastCalculation: null
    }
  }
}

module.exports = DataDifferenceEngine
