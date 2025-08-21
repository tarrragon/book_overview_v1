/**
 * @fileoverview Data Difference Engine - 純粹資料差異計算演算法
 * @version v0.9.20
 * @since 2025-08-20
 *
 * 從 data-synchronization-service.js 提取的核心差異計算邏輯
 *
 * 負責功能：
 * - 純粹的資料差異計算演算法
 * - 高效能的項目比較邏輯
 * - 變更詳情分析和分類
 * - 統計資訊收集和效能監控
 *
 * 設計原則：
 * - 無外部依賴：純粹的演算法邏輯
 * - 可配置：支援不同比較策略
 * - 高效能：優化的比較演算法
 * - 類型安全：完整的參數驗證
 */

class DataDifferenceEngine {
  /**
   * 初始化資料差異引擎
   * @param {Object} config - 比較配置
   */
  constructor (config = {}) {
    this.config = this.mergeWithDefaults(config)
    this.statistics = this.initializeStatistics()
  }

  /**
   * 合併預設配置
   * @param {Object} userConfig - 使用者配置
   * @returns {Object} 合併後的配置
   */
  mergeWithDefaults (userConfig) {
    const defaults = {
      compareFields: ['title', 'progress', 'lastUpdated'],
      caseSensitive: true,
      numericTolerance: 0
    }

    return {
      ...defaults,
      ...this.sanitizeConfig(userConfig)
    }
  }

  /**
   * 清理配置值
   * @param {Object} config - 原始配置
   * @returns {Object} 清理後的配置
   */
  sanitizeConfig (config) {
    const sanitized = {}

    if (Array.isArray(config.compareFields)) {
      sanitized.compareFields = config.compareFields
    }

    if (typeof config.caseSensitive === 'boolean') {
      sanitized.caseSensitive = config.caseSensitive
    }

    if (typeof config.numericTolerance === 'number' && !isNaN(config.numericTolerance)) {
      sanitized.numericTolerance = Math.max(0, config.numericTolerance)
    }

    return sanitized
  }

  /**
   * 初始化統計資料
   * @returns {Object} 初始統計物件
   */
  initializeStatistics () {
    return {
      totalCalculations: 0,
      totalChangesProcessed: 0,
      lastCalculation: null
    }
  }

  /**
   * 計算兩個資料集的差異
   * @param {Array} sourceData - 來源資料
   * @param {Array} targetData - 目標資料
   * @returns {Object} 差異計算結果
   */
  calculateDifferences (sourceData, targetData) {
    const startTime = Date.now()

    try {
      // 確保輸入為陣列
      const source = this.ensureArray(sourceData)
      const target = this.ensureArray(targetData)

      // 建立目標資料的 ID 對應表
      const targetMap = this.buildTargetMap(target)

      const added = []
      const modified = []
      const unchanged = []

      // 處理來源資料中的每個項目
      for (const sourceItem of source) {
        if (!this.isValidItem(sourceItem)) {
          continue // 跳過無效資料
        }

        const targetItem = targetMap.get(sourceItem.id)

        if (!targetItem) {
          // 目標中不存在，標記為新增
          added.push(sourceItem)
        } else {
          // 比較是否有變更
          const hasChanges = this.compareItems(sourceItem, targetItem)
          if (hasChanges) {
            modified.push({
              id: sourceItem.id,
              source: sourceItem,
              target: targetItem,
              changes: this.getFieldChanges(sourceItem, targetItem)
            })
          } else {
            unchanged.push(sourceItem)
          }

          // 從目標對應表中移除已處理的項目
          targetMap.delete(sourceItem.id)
        }
      }

      // 剩餘在目標對應表中的項目為刪除項目
      const deleted = Array.from(targetMap.values())

      const result = {
        added,
        modified,
        deleted,
        unchanged,
        summary: {
          addedCount: added.length,
          modifiedCount: modified.length,
          deletedCount: deleted.length,
          unchangedCount: unchanged.length,
          totalChanges: added.length + modified.length + deleted.length
        }
      }

      // 更新統計資訊
      this.updateStatistics(result, source.length, target.length, Date.now() - startTime)

      return result
    } catch (error) {
      throw new Error(`資料差異計算失敗: ${error.message}`)
    }
  }

  /**
   * 確保輸入為陣列
   * @param {any} data - 輸入資料
   * @returns {Array} 陣列格式的資料
   */
  ensureArray (data) {
    if (Array.isArray(data)) {
      return data
    }
    if (data === null || data === undefined) {
      return []
    }
    return [data]
  }

  /**
   * 建立目標資料的 ID 對應表
   * @param {Array} target - 目標資料陣列
   * @returns {Map} ID 對應表
   */
  buildTargetMap (target) {
    const targetMap = new Map()

    for (const item of target) {
      if (this.isValidItem(item)) {
        targetMap.set(item.id, item)
      }
    }

    return targetMap
  }

  /**
   * 檢查項目是否有效
   * @param {any} item - 要檢查的項目
   * @returns {boolean} 是否有效
   */
  isValidItem (item) {
    return item && typeof item === 'object' && item.id
  }

  /**
   * 比較兩個項目是否有差異
   * @param {Object} source - 來源項目
   * @param {Object} target - 目標項目
   * @returns {boolean} 是否有差異
   */
  compareItems (source, target) {
    const { compareFields, caseSensitive, numericTolerance } = this.config

    // 高效循環：提早退出機制
    for (let i = 0; i < compareFields.length; i++) {
      const field = compareFields[i]
      const sourceValue = source[field]
      const targetValue = target[field]

      // 快速等同檢查
      if (sourceValue === targetValue) continue

      // 特殊類型處理
      if (typeof sourceValue === 'string' && typeof targetValue === 'string') {
        if (!caseSensitive) {
          if (sourceValue.toLowerCase() !== targetValue.toLowerCase()) {
            return true
          }
        } else {
          return true
        }
      } else if (typeof sourceValue === 'number' && typeof targetValue === 'number') {
        // 數字類型精度檢查
        if (Math.abs(sourceValue - targetValue) > numericTolerance) {
          return true
        }
      } else {
        // 其他類型直接比較
        return true
      }
    }

    return false
  }

  /**
   * 取得欄位變更詳情
   * @param {Object} source - 來源資料
   * @param {Object} target - 目標資料
   * @returns {Object} 變更詳情
   */
  getFieldChanges (source, target) {
    const changes = {}
    const { compareFields, caseSensitive, numericTolerance } = this.config

    for (const field of compareFields) {
      const sourceValue = source[field]
      const targetValue = target[field]

      let hasChange = false

      // 精細的變更檢測
      if (sourceValue === targetValue) {
        continue
      } else if (typeof sourceValue === 'string' && typeof targetValue === 'string') {
        if (caseSensitive) {
          hasChange = sourceValue !== targetValue
        } else {
          hasChange = sourceValue.toLowerCase() !== targetValue.toLowerCase()
        }
      } else if (typeof sourceValue === 'number' && typeof targetValue === 'number') {
        hasChange = Math.abs(sourceValue - targetValue) > numericTolerance
      } else {
        hasChange = true
      }

      if (hasChange) {
        changes[field] = {
          from: targetValue,
          to: sourceValue,
          type: 'modified',
          severity: this.calculateChangeSeverity(field, sourceValue, targetValue)
        }
      }
    }

    return changes
  }

  /**
   * 計算變更嚴重程度
   * @param {string} field - 欄位名稱
   * @param {any} sourceValue - 新值
   * @param {any} targetValue - 舊值
   * @returns {string} 嚴重程度 (low|medium|high)
   */
  calculateChangeSeverity (field, sourceValue, targetValue) {
    // 基於欄位類型和變更幅度判斷嚴重程度
    if (field === 'title') {
      return 'medium' // 標題變更通常較重要
    }

    if (field === 'progress' && typeof sourceValue === 'number' && typeof targetValue === 'number') {
      const diff = Math.abs(sourceValue - targetValue)
      if (diff >= 50) return 'high'
      if (diff >= 30) return 'medium'
      return 'low'
    }

    return 'low' // 預設為低嚴重程度
  }

  /**
   * 更新統計資訊
   * @param {Object} result - 差異計算結果
   * @param {number} sourceCount - 來源資料數量
   * @param {number} targetCount - 目標資料數量
   * @param {number} calculationTime - 計算耗時
   */
  updateStatistics (result, sourceCount, targetCount, calculationTime) {
    this.statistics.totalCalculations++
    this.statistics.totalChangesProcessed += result.summary.totalChanges
    this.statistics.lastCalculation = {
      sourceCount,
      targetCount,
      addedCount: result.summary.addedCount,
      modifiedCount: result.summary.modifiedCount,
      deletedCount: result.summary.deletedCount,
      unchangedCount: result.summary.unchangedCount,
      totalChanges: result.summary.totalChanges,
      calculationTime
    }
  }

  /**
   * 動態更新配置
   * @param {Object} newConfig - 新配置
   */
  updateConfig (newConfig) {
    this.config = {
      ...this.config,
      ...this.sanitizeConfig(newConfig)
    }
  }

  /**
   * 獲取當前配置
   * @returns {Object} 當前配置
   */
  getConfig () {
    return { ...this.config }
  }

  /**
   * 重置為預設配置
   */
  resetConfig () {
    this.config = this.mergeWithDefaults({})
  }

  /**
   * 獲取統計資訊
   * @returns {Object} 統計資訊
   */
  getStatistics () {
    return {
      ...this.statistics,
      lastCalculation: this.statistics.lastCalculation ? { ...this.statistics.lastCalculation } : null
    }
  }

  /**
   * 清除統計資料
   */
  clearStatistics () {
    this.statistics = this.initializeStatistics()
  }
}

module.exports = DataDifferenceEngine
