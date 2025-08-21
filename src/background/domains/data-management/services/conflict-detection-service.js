/**
 * @fileoverview Conflict Detection Service - 衝突檢測與分析服務
 * @version v0.9.20
 * @since 2025-08-20
 *
 * 從 data-synchronization-service.js 提取的智能衝突檢測邏輯
 *
 * 負責功能：
 * - 智能衝突檢測和分析
 * - 衝突類型分類和嚴重程度評估
 * - 解決建議生成和自動化處理支援
 * - 與 DataDifferenceEngine 協作進行深度分析
 *
 * 設計原則：
 * - 專門化衝突檢測：專注於智能衝突識別和分析
 * - 與差異引擎協作：基於差異計算結果進行衝突檢測
 * - 可配置策略：支援不同的衝突檢測閾值和策略
 * - 統計監控：提供衝突檢測統計和效能監控
 */

const BaseModule = require('../../../lifecycle/base-module.js')

class ConflictDetectionService extends BaseModule {
  /**
   * 初始化衝突檢測服務
   * @param {EventBus} eventBus - 事件總線實例
   * @param {Object} dependencies - 依賴注入物件
   */
  constructor (eventBus, dependencies = {}) {
    if (!eventBus) {
      throw new Error('EventBus is required')
    }

    super({
      eventBus,
      logger: dependencies.logger || console,
      config: dependencies.config || {}
    })

    this.eventBus = eventBus
    this.logger = dependencies.logger || console
    this.dataDifferenceEngine = dependencies.dataDifferenceEngine

    // 合併預設配置
    this.effectiveConfig = this.mergeWithDefaults(dependencies.config || {})

    // 衝突檢測統計
    this.conflictStatistics = {
      totalConflictsDetected: 0,
      resolvedConflicts: 0,
      autoResolvedConflicts: 0,
      manualResolvedConflicts: 0,
      lastDetectionTime: null
    }
  }

  /**
   * 合併預設配置
   */
  mergeWithDefaults (userConfig) {
    const defaults = {
      progressConflictThreshold: 15,
      enableIntelligentConflictDetection: true,
      autoResolveConflicts: false,
      timestampTolerance: 1000 // 1秒容差
    }

    return {
      ...defaults,
      ...userConfig
    }
  }

  /**
   * 檢測資料衝突
   * @param {Array} sourceData - 來源資料
   * @param {Array} targetData - 目標資料
   * @returns {Object} 衝突檢測結果
   */
  async detectConflicts (sourceData, targetData) {
    try {
      // 使用 DataDifferenceEngine 計算差異
      const differences = this.dataDifferenceEngine.calculateDifferences(sourceData, targetData)

      const conflicts = []

      // 檢查修改項目中的衝突
      if (differences.modified) {
        for (const modifiedItem of differences.modified) {
          const conflict = this.checkItemConflicts(modifiedItem)
          if (conflict) {
            conflicts.push(conflict)
          }
        }
      }

      // 計算衝突報告
      const conflictReport = {
        hasConflicts: conflicts.length > 0,
        conflictCount: conflicts.length,
        conflicts,
        severity: this.calculateConflictSeverity(conflicts),
        recommendations: this.generateConflictRecommendations(conflicts)
      }

      // 更新統計
      this.updateConflictStatistics(conflicts)

      return conflictReport
    } catch (error) {
      throw error
    }
  }

  /**
   * 檢查單個項目的衝突
   */
  checkItemConflicts (modifiedItem) {
    const { id, source, target, changes } = modifiedItem
    const conflicts = []

    // 檢查每個變更欄位的衝突
    for (const field in changes) {
      const change = changes[field]
      const conflict = this.detectFieldConflict(field, change, source, target)
      if (conflict) {
        conflicts.push({
          ...conflict,
          itemId: id,
          field,
          sourceValue: change.to,
          targetValue: change.from
        })
      }
    }

    if (conflicts.length === 0) return null
    if (conflicts.length === 1) return conflicts[0]

    // 返回優先級最高的衝突
    return conflicts.reduce((prev, current) =>
      this.getConflictPriority(current.type) > this.getConflictPriority(prev.type) ? current : prev
    )
  }

  /**
   * 檢測欄位特定衝突
   */
  detectFieldConflict (field, change, source, target) {
    switch (field) {
      case 'progress':
        return this.detectProgressConflict(change, source, target)
      case 'title':
        return this.detectTitleConflict(change, source, target)
      case 'lastUpdated':
        return this.detectTimestampConflict(change, source, target)
      default:
        return this.detectGenericConflict(field, change, source, target)
    }
  }

  /**
   * 檢測進度衝突
   */
  detectProgressConflict (change, source, target) {
    const { from: targetProgress, to: sourceProgress } = change
    const threshold = this.effectiveConfig.progressConflictThreshold || 15

    const progressDiff = Math.abs(sourceProgress - targetProgress)

    if (progressDiff >= threshold) {
      return {
        type: 'PROGRESS_CONFLICT',
        severity: progressDiff >= 50 ? 'HIGH' : progressDiff >= 30 ? 'MEDIUM' : 'LOW',
        description: `進度差異過大：來源 ${sourceProgress}% vs 目標 ${targetProgress}%`,
        recommendation: sourceProgress > targetProgress ? 'USE_HIGHER_PROGRESS' : 'USE_HIGHER_PROGRESS'
      }
    }

    return null
  }

  /**
   * 檢測標題衝突
   */
  detectTitleConflict (change, source, target) {
    const { from: targetTitle, to: sourceTitle } = change

    if (sourceTitle !== targetTitle) {
      return {
        type: 'TITLE_CONFLICT',
        severity: 'MEDIUM',
        description: `標題不一致：來源 "${sourceTitle}" vs 目標 "${targetTitle}"`,
        recommendation: 'MANUAL_REVIEW'
      }
    }

    return null
  }

  /**
   * 檢測時間戳衝突
   */
  detectTimestampConflict (change, source, target) {
    const { from: targetTime, to: sourceTime } = change

    const sourceDate = new Date(sourceTime)
    const targetDate = new Date(targetTime)

    if (targetDate > sourceDate) {
      return {
        type: 'TIMESTAMP_CONFLICT',
        severity: 'LOW',
        description: `時間戳衝突：目標較新 (${targetTime} > ${sourceTime})`,
        recommendation: 'USE_LATEST_TIMESTAMP'
      }
    }

    return null
  }

  /**
   * 檢測通用衝突
   */
  detectGenericConflict (field, change, source, target) {
    return {
      type: 'GENERIC_CONFLICT',
      severity: 'LOW',
      description: `欄位 ${field} 有變更`,
      recommendation: 'MANUAL_REVIEW'
    }
  }

  /**
   * 獲取衝突優先級
   */
  getConflictPriority (conflictType) {
    const priorities = {
      PROGRESS_CONFLICT: 4,
      TITLE_CONFLICT: 3,
      TIMESTAMP_CONFLICT: 2,
      GENERIC_CONFLICT: 1
    }
    return priorities[conflictType] || 1
  }

  /**
   * 計算衝突嚴重程度
   */
  calculateConflictSeverity (conflicts) {
    if (conflicts.length === 0) return 'NONE'

    const typeWeights = {
      PROGRESS_CONFLICT: 3,
      TITLE_CONFLICT: 2,
      TIMESTAMP_CONFLICT: 1,
      GENERIC_CONFLICT: 1
    }

    let maxSeverity = 'LOW'

    for (const conflict of conflicts) {
      if (conflict.severity === 'HIGH') {
        maxSeverity = 'HIGH'
        break
      } else if (conflict.severity === 'MEDIUM' && maxSeverity !== 'HIGH') {
        maxSeverity = 'MEDIUM'
      }
    }

    return maxSeverity
  }

  /**
   * 生成衝突解決建議
   */
  generateConflictRecommendations (conflicts) {
    const recommendations = []

    for (const conflict of conflicts) {
      const rec = this.createSmartRecommendation(conflict)
      if (rec) {
        recommendations.push(rec)
      }
    }

    // 批量處理建議
    if (conflicts.length > 5) {
      recommendations.push({
        strategy: 'BATCH_PROCESSING',
        description: `建議采用批量處理策略，共 ${conflicts.length} 個衝突`,
        confidence: this.calculateRecommendationConfidence(conflicts),
        estimatedTime: this.estimateResolutionTime(conflicts)
      })
    }

    return recommendations
  }

  /**
   * 建立智能建議
   */
  createSmartRecommendation (conflict) {
    const base = {
      conflictId: conflict.itemId,
      field: conflict.field,
      conflictType: conflict.type,
      severity: conflict.severity
    }

    switch (conflict.type) {
      case 'PROGRESS_CONFLICT':
        return {
          ...base,
          strategy: conflict.recommendation || 'USE_HIGHER_PROGRESS',
          autoResolvable: true,
          confidence: 0.8
        }

      case 'TITLE_CONFLICT':
        return {
          ...base,
          strategy: 'MANUAL_REVIEW',
          autoResolvable: false,
          confidence: 0.2
        }

      case 'TIMESTAMP_CONFLICT':
        return {
          ...base,
          strategy: 'USE_LATEST_TIMESTAMP',
          autoResolvable: true,
          confidence: 0.9
        }

      default:
        return {
          ...base,
          strategy: 'MANUAL_REVIEW',
          autoResolvable: false,
          confidence: 0.1
        }
    }
  }

  /**
   * 計算建議信心度
   */
  calculateRecommendationConfidence (conflicts) {
    const autoResolvableCount = conflicts.filter(c =>
      c.type === 'PROGRESS_CONFLICT' || c.type === 'TIMESTAMP_CONFLICT'
    ).length

    return autoResolvableCount / conflicts.length
  }

  /**
   * 估算解決時間
   */
  estimateResolutionTime (conflicts) {
    const manualCount = conflicts.filter(c =>
      c.type === 'TITLE_CONFLICT' || c.type === 'GENERIC_CONFLICT'
    ).length

    const autoCount = conflicts.length - manualCount

    return (manualCount * 30 + autoCount * 5) + ' seconds'
  }

  /**
   * 更新衝突統計
   */
  updateConflictStatistics (conflicts, resolution = {}) {
    this.conflictStatistics.totalConflictsDetected += conflicts.length
    this.conflictStatistics.resolvedConflicts += resolution.resolvedCount || 0
    this.conflictStatistics.autoResolvedConflicts += resolution.autoResolvedCount || 0
    this.conflictStatistics.manualResolvedConflicts += resolution.manualResolvedCount || 0
    this.conflictStatistics.lastDetectionTime = new Date()
  }

  /**
   * 獲取統計資料
   */
  getConflictStatistics () {
    return { ...this.conflictStatistics }
  }

  /**
   * 清除統計資料
   */
  clearConflictStatistics () {
    this.conflictStatistics = {
      totalConflictsDetected: 0,
      resolvedConflicts: 0,
      autoResolvedConflicts: 0,
      manualResolvedConflicts: 0,
      lastDetectionTime: null
    }
  }

  /**
   * 動態更新配置
   */
  updateConfig (newConfig) {
    this.effectiveConfig = {
      ...this.effectiveConfig,
      ...newConfig
    }
  }

  /**
   * 獲取當前配置
   */
  getConfig () {
    return { ...this.effectiveConfig }
  }

  /**
   * 發送衝突事件
   */
  async emitConflictEvent (eventType, eventData) {
    await this.eventBus.emit(`DATA.CONFLICT.${eventType}`, {
      ...eventData,
      timestamp: Date.now(),
      source: 'ConflictDetectionService'
    })
  }
}

module.exports = ConflictDetectionService
