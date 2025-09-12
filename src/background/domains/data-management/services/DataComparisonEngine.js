/**
 * DataComparisonEngine - 資料比較引擎
 *
 * 職責：
 * - 高效能資料比較演算法
 * - 差異計算和變更檢測
 * - 批次處理和效能統計
 *
 * TDD實作：根據測試驅動的最小可行實作
 */
const { StandardError } = require('src/core/errors/StandardError')

class DataComparisonEngine {
  constructor (config = {}) {
    // 預設配置
    this.config = {
      compareFields: ['title', 'progress', 'lastUpdated'],
      caseSensitive: true,
      numericTolerance: 0,
      batchSize: 100,
      ...config
    }

    // 統計資料
    this.stats = {
      totalComparisons: 0,
      totalProcessingTime: 0,
      config: this.config,
      timestamp: Date.now()
    }

    this.isInitialized = true
  }

  /**
   * 計算資料差異
   * @param {Array} sourceData 源資料
   * @param {Array} targetData 目標資料
   * @returns {Object} 差異結果
   */
  async calculateDataDifferences (sourceData, targetData) {
    const startTime = performance.now()

    // 輸入驗證
    if (!Array.isArray(sourceData) || !Array.isArray(targetData)) {
      throw new StandardError('UNKNOWN_ERROR', 'Source and target data must be arrays', {
          "dataType": "array",
          "category": "general"
      })
    }

    // 過濾有效項目
    const validSource = sourceData.filter(item => item && item.id)
    const validTarget = targetData.filter(item => item && item.id)

    // 建立索引Map加速查找
    const sourceMap = new Map(validSource.map(item => [item.id, item]))
    const targetMap = new Map(validTarget.map(item => [item.id, item]))

    const changes = {
      added: [],
      modified: [],
      deleted: [],
      unchanged: []
    }

    // 檢查新增和修改
    for (const [id, sourceItem] of sourceMap) {
      if (!targetMap.has(id)) {
        changes.added.push({ id, data: sourceItem })
      } else {
        const targetItem = targetMap.get(id)
        if (this.compareBookDataOptimized(sourceItem, targetItem)) {
          changes.modified.push({
            id,
            fieldChanges: this.getFieldChanges(sourceItem, targetItem)
          })
        } else {
          changes.unchanged.push({ id, data: sourceItem })
        }
      }
    }

    // 檢查刪除
    for (const [id, targetItem] of targetMap) {
      if (!sourceMap.has(id)) {
        changes.deleted.push({ id, data: targetItem })
      }
    }

    const processingTime = performance.now() - startTime
    this.stats.totalComparisons++
    this.stats.totalProcessingTime += processingTime

    return {
      changes,
      summary: {
        total: validSource.length + validTarget.length,
        added: changes.added.length,
        modified: changes.modified.length,
        deleted: changes.deleted.length,
        unchanged: changes.unchanged.length
      },
      processingTime
    }
  }

  /**
   * 最佳化書籍資料比較
   * @param {Object} book1 第一個書籍
   * @param {Object} book2 第二個書籍
   * @returns {boolean} 是否有差異
   */
  compareBookDataOptimized (book1, book2) {
    for (const field of this.config.compareFields) {
      const value1 = book1[field]
      const value2 = book2[field]

      if (!this._compareValues(value1, value2)) {
        return true // 有差異
      }
    }
    return false // 無差異
  }

  /**
   * 獲取欄位變更詳情
   * @param {Object} source 源資料
   * @param {Object} target 目標資料
   * @returns {Object} 欄位變更詳情
   */
  getFieldChanges (source, target) {
    const changes = {}

    for (const field of this.config.compareFields) {
      const sourceValue = source[field]
      const targetValue = target[field]

      if (!this._compareValues(sourceValue, targetValue)) {
        changes[field] = {
          source: sourceValue,
          target: targetValue
        }
      }
    }

    return changes
  }

  /**
   * 獲取變更類型
   * @param {*} oldValue 舊值
   * @param {*} newValue 新值
   * @returns {string} 變更類型
   */
  getChangeType (oldValue, newValue) {
    if (oldValue !== null && newValue === null) return 'ADDED'
    if (oldValue === null && newValue !== null) return 'REMOVED'
    if (typeof oldValue !== typeof newValue) return 'TYPE_CHANGED'
    if (oldValue !== newValue) return 'VALUE_CHANGED'
    return 'NO_CHANGE'
  }

  /**
   * 計算變更嚴重性
   * @param {string} field 欄位名稱
   * @param {*} oldValue 舊值
   * @param {*} newValue 新值
   * @returns {string} 嚴重性等級
   */
  calculateChangeSeverity (field, oldValue, newValue) {
    if (field === 'progress' && typeof oldValue === 'number' && typeof newValue === 'number') {
      const diff = Math.abs(newValue - oldValue)
      if (diff >= 50) return 'HIGH'
      if (diff >= 25) return 'MEDIUM'
      return 'LOW'
    }

    // 其他欄位的預設邏輯
    if (oldValue === null || newValue === null) return 'HIGH'
    return 'MEDIUM'
  }

  /**
   * 計算字串相似度
   * @param {string} str1 第一個字串
   * @param {string} str2 第二個字串
   * @returns {number} 相似度 (0-1)
   */
  calculateStringSimilarity (str1, str2) {
    if (str1 === str2) return 1
    if (!str1 || !str2) return 0

    // 簡單的Levenshtein距離實作
    const len1 = str1.length
    const len2 = str2.length
    const matrix = Array(len2 + 1).fill(null).map(() => Array(len1 + 1).fill(null))

    for (let i = 0; i <= len1; i++) matrix[0][i] = i
    for (let j = 0; j <= len2; j++) matrix[j][0] = j

    for (let j = 1; j <= len2; j++) {
      for (let i = 1; i <= len1; i++) {
        const cost = str1[i - 1] === str2[j - 1] ? 0 : 1
        matrix[j][i] = Math.min(
          matrix[j - 1][i] + 1,
          matrix[j][i - 1] + 1,
          matrix[j - 1][i - 1] + cost
        )
      }
    }

    const distance = matrix[len2][len1]
    const maxLength = Math.max(len1, len2)
    return maxLength === 0 ? 1 : (maxLength - distance) / maxLength
  }

  /**
   * 更新配置
   * @param {Object} newConfig 新配置
   */
  updateConfig (newConfig) {
    this.config = { ...this.config, ...newConfig }
    this.stats.config = this.config
  }

  /**
   * 獲取統計資訊
   * @returns {Object} 統計資訊
   */
  getStatistics () {
    return {
      ...this.stats,
      timestamp: Date.now()
    }
  }

  /**
   * 重置統計
   */
  resetStatistics () {
    this.stats = {
      totalComparisons: 0,
      totalProcessingTime: 0,
      config: this.config,
      timestamp: Date.now()
    }
  }

  /**
   * 批次處理
   * @param {Array} sourceData 源資料
   * @param {Array} targetData 目標資料
   * @returns {Object} 批次處理結果
   */
  async processBatch (sourceData, targetData) {
    const startTime = performance.now()
    const batchSize = this.config.batchSize
    let batches = 0

    // 簡單的批次處理實作
    const allItems = [...sourceData, ...targetData]
    for (let i = 0; i < allItems.length; i += batchSize) {
      // 處理批次 (這裡是簡化實作)
      await new Promise(resolve => setTimeout(resolve, 1))
      batches++
    }

    const result = await this.calculateDataDifferences(sourceData, targetData)
    const processingTime = performance.now() - startTime

    return {
      ...result,
      batches,
      processingTime
    }
  }

  /**
   * 私有方法：比較兩個值
   * @param {*} value1 第一個值
   * @param {*} value2 第二個值
   * @returns {boolean} 是否相同
   */
  _compareValues (value1, value2) {
    // 處理數值容錯
    if (typeof value1 === 'number' && typeof value2 === 'number') {
      return Math.abs(value1 - value2) <= this.config.numericTolerance
    }

    // 處理字串大小寫
    if (typeof value1 === 'string' && typeof value2 === 'string') {
      if (!this.config.caseSensitive) {
        return value1.toLowerCase() === value2.toLowerCase()
      }
    }

    return value1 === value2
  }
}

module.exports = DataComparisonEngine
