/**
 * @fileoverview ConflictDetectionService - 智能衝突檢測和分析服務
 * @version 1.0.0
 * @since 2025-08-19
 *
 * 負責功能：
 * - 智能衝突檢測和分類
 * - 衝突嚴重性分析和優先級排序
 * - 自動解決策略生成和建議
 * - 衝突統計和趨勢分析
 *
 * 設計考量：
 * - 從 data-synchronization-service.js 拆分的衝突檢測邏輯
 * - 支援多種衝突類型和檢測規則
 * - 提供智能建議和自動解決機制
 * - 高效能的批次衝突檢測
 *
 * 處理流程：
 * 1. 接收資料變更和衝突上下文
 * 2. 執行多層級衝突檢測分析
 * 3. 計算衝突嚴重性和影響範圍
 * 4. 生成解決建議和自動處理策略
 * 5. 回傳結構化的衝突報告
 *
 * 使用情境：
 * - ReadmooSynchronizationCoordinator 的核心依賴
 * - 資料同步過程中的衝突預防和處理
 * - 使用者手動同步的衝突分析
 * - 系統自動化衝突解決
 */

class ConflictDetectionService {
  /**
   * 建構衝突檢測服務
   * @param {Object} options - 檢測選項配置
   */
  constructor (options = {}) {
    // 衝突檢測配置
    this.config = {
      progressConflictThreshold: options.progressConflictThreshold || 15,
      titleSimilarityThreshold: options.titleSimilarityThreshold || 0.8,
      timestampConflictWindow: options.timestampConflictWindow || 60000, // 1分鐘
      enableIntelligentDetection: options.enableIntelligentDetection !== false,
      autoResolveConflicts: options.autoResolveConflicts || false,
      maxConflictsPerItem: options.maxConflictsPerItem || 10,
      ...options
    }

    // 衝突類型定義
    this.conflictTypes = {
      PROGRESS_MISMATCH: 'PROGRESS_MISMATCH',
      TITLE_DIVERGENCE: 'TITLE_DIVERGENCE',
      TIMESTAMP_CONFLICT: 'TIMESTAMP_CONFLICT',
      DATA_TYPE_MISMATCH: 'DATA_TYPE_MISMATCH',
      VALUE_INCONSISTENCY: 'VALUE_INCONSISTENCY',
      METADATA_CONFLICT: 'METADATA_CONFLICT'
    }

    // 衝突嚴重性等級
    this.severityLevels = {
      CRITICAL: 'CRITICAL', // 15+ 分
      HIGH: 'HIGH', // 10-14 分
      MEDIUM: 'MEDIUM', // 5-9 分
      LOW: 'LOW', // 1-4 分
      NONE: 'NONE' // 0 分
    }

    // 統計資訊
    this.stats = {
      totalConflictsDetected: 0,
      resolvedConflicts: 0,
      autoResolvedConflicts: 0,
      conflictsByType: {},
      averageResolutionTime: 0
    }

    // 初始化衝突類型統計
    Object.keys(this.conflictTypes).forEach(type => {
      this.stats.conflictsByType[type] = 0
    })

    this.isInitialized = true
  }

  /**
   * 檢測資料衝突
   * @param {Array} sourceData - 源資料
   * @param {Array} targetData - 目標資料
   * @param {Object} changes - 資料變更物件
   * @returns {Promise<Object>} 衝突檢測結果
   */
  async detectConflicts (sourceData, targetData, changes) {
    const startTime = Date.now()

    try {
      const conflicts = {
        items: [],
        summary: {
          totalConflicts: 0,
          conflictsByType: { ...this.stats.conflictsByType },
          conflictsBySeverity: {
            CRITICAL: 0,
            HIGH: 0,
            MEDIUM: 0,
            LOW: 0
          }
        },
        hasConflicts: false,
        severity: 'NONE',
        recommendations: [],
        autoResolvable: false
      }

      // 檢查修改項目的衝突
      if (changes.modified) {
        for (const modifiedItem of changes.modified) {
          const itemConflicts = this.checkItemConflicts(modifiedItem)
          if (itemConflicts && itemConflicts.length > 0) {
            conflicts.items.push({
              id: modifiedItem.id,
              conflicts: itemConflicts,
              sourceData: modifiedItem.sourceData,
              targetData: modifiedItem.targetData
            })
          }
        }
      }

      // 計算衝突統計
      if (conflicts.items.length > 0) {
        conflicts.hasConflicts = true
        conflicts.summary.totalConflicts = conflicts.items.reduce((sum, item) =>
          sum + item.conflicts.length, 0)

        // 統計各類型衝突
        conflicts.items.forEach(item => {
          item.conflicts.forEach(conflict => {
            conflicts.summary.conflictsByType[conflict.type]++
            conflicts.summary.conflictsBySeverity[conflict.severity]++
          })
        })

        // 計算整體嚴重性
        conflicts.severity = this.calculateConflictSeverity(conflicts.items)

        // 生成解決建議
        conflicts.recommendations = this.generateConflictRecommendations(conflicts.items)

        // 判斷是否可自動解決
        conflicts.autoResolvable = this.isAutoResolvable(conflicts)
      }

      // 更新統計
      this.stats.totalConflictsDetected += conflicts.summary.totalConflicts || conflicts.items.reduce((sum, item) => sum + item.conflicts.length, 0)
      const processingTime = Date.now() - startTime

      return {
        ...conflicts,
        processingTime,
        timestamp: Date.now()
      }
    } catch (error) {
      throw new Error(`Conflict detection failed: ${error.message}`)
    }
  }

  /**
   * 檢查單一項目的衝突
   * @param {Object} modifiedItem - 修改的項目
   * @returns {Array} 衝突陣列
   */
  checkItemConflicts (modifiedItem) {
    const conflicts = []
    const { sourceData, targetData, fieldChanges } = modifiedItem

    if (!fieldChanges) {
      return conflicts
    }

    // 限制每個項目的衝突檢測數量
    let conflictCount = 0
    const maxConflicts = this.config.maxConflictsPerItem

    // 逐欄位檢測衝突
    for (const [field, change] of Object.entries(fieldChanges)) {
      if (conflictCount >= maxConflicts) break

      const conflict = this.detectFieldConflict(field, change, sourceData, targetData)
      if (conflict) {
        conflicts.push(conflict)
        conflictCount++
      }
    }

    // 如果只有一個衝突，直接返回
    if (conflicts.length <= 1) {
      return conflicts
    }

    // 多重衝突需要進行複合分析
    return this.analyzeMultipleConflicts(conflicts, sourceData, targetData)
  }

  /**
   * 分析多重衝突
   * @param {Array} conflicts - 衝突陣列
   * @param {Object} sourceData - 源資料
   * @param {Object} targetData - 目標資料
   * @returns {Array} 分析後的衝突陣列
   */
  analyzeMultipleConflicts (conflicts, sourceData, targetData) {
    // 如果有多個衝突，建立複合衝突
    const compositeConflict = {
      id: `composite_${Date.now()}`,
      type: 'COMPOSITE_CONFLICT',
      severity: this.calculateCompositeSeverity(conflicts),
      subConflicts: conflicts,
      priority: Math.max(...conflicts.map(c => this.getConflictPriority(c.type))),
      resolutionComplexity: 'HIGH',
      estimatedResolutionTime: this.estimateResolutionTime(conflicts),
      autoResolvable: conflicts.every(c => c.autoResolvable),
      recommendedStrategy: this.selectCompositeStrategy(conflicts)
    }

    return [compositeConflict]
  }

  /**
   * 檢測欄位衝突
   * @param {string} field - 欄位名稱
   * @param {Object} change - 欄位變更
   * @param {Object} source - 源資料
   * @param {Object} target - 目標資料
   * @returns {Object|null} 衝突物件或 null
   */
  detectFieldConflict (field, change, source, target) {
    switch (field) {
      case 'progress':
        return this.detectProgressConflict(change, source, target)
      case 'title':
        return this.detectTitleConflict(change, source, target)
      case 'lastUpdated':
      case 'timestamp':
        return this.detectTimestampConflict(change, source, target)
      default:
        return this.detectGenericConflict(field, change, source, target)
    }
  }

  /**
   * 檢測進度衝突
   * @param {Object} change - 進度變更
   * @param {Object} source - 源資料
   * @param {Object} target - 目標資料
   * @returns {Object|null} 衝突物件
   */
  detectProgressConflict (change, source, target) {
    const diff = Math.abs(change.source - change.target)
    const threshold = this.config.progressConflictThreshold

    if (diff > threshold) {
      return {
        id: `progress_conflict_${Date.now()}`,
        type: this.conflictTypes.PROGRESS_MISMATCH,
        field: 'progress',
        severity: this.calculateProgressSeverity(diff),
        sourceValue: change.source,
        targetValue: change.target,
        difference: diff,
        threshold,
        priority: this.getConflictPriority(this.conflictTypes.PROGRESS_MISMATCH),
        autoResolvable: diff < 30, // 差異小於30%可自動解決
        recommendedStrategy: diff > 50 ? 'MANUAL_REVIEW' : 'USE_HIGHER_VALUE',
        confidence: this.calculateConfidence('progress', change, source, target)
      }
    }

    return null
  }

  /**
   * 檢測標題衝突
   * @param {Object} change - 標題變更
   * @param {Object} source - 源資料
   * @param {Object} target - 目標資料
   * @returns {Object|null} 衝突物件
   */
  detectTitleConflict (change, source, target) {
    if (change.type === 'VALUE_CHANGED') {
      const similarity = this.calculateStringSimilarity(change.source, change.target)
      const threshold = this.config.titleSimilarityThreshold

      if (similarity < threshold) {
        return {
          id: `title_conflict_${Date.now()}`,
          type: this.conflictTypes.TITLE_DIVERGENCE,
          field: 'title',
          severity: similarity < 0.5 ? 'HIGH' : 'MEDIUM',
          sourceValue: change.source,
          targetValue: change.target,
          similarity,
          threshold,
          priority: this.getConflictPriority(this.conflictTypes.TITLE_DIVERGENCE),
          autoResolvable: similarity > 0.6, // 相似度大於60%可自動解決
          recommendedStrategy: similarity < 0.3 ? 'MANUAL_REVIEW' : 'USE_LONGER_TITLE',
          confidence: this.calculateConfidence('title', change, source, target)
        }
      }
    }

    return null
  }

  /**
   * 檢測時間戳衝突
   * @param {Object} change - 時間戳變更
   * @param {Object} source - 源資料
   * @param {Object} target - 目標資料
   * @returns {Object|null} 衝突物件
   */
  detectTimestampConflict (change, source, target) {
    const sourceTime = new Date(change.source).getTime()
    const targetTime = new Date(change.target).getTime()
    const timeDiff = Math.abs(sourceTime - targetTime)
    const window = this.config.timestampConflictWindow

    if (timeDiff < window) {
      return {
        id: `timestamp_conflict_${Date.now()}`,
        type: this.conflictTypes.TIMESTAMP_CONFLICT,
        field: 'timestamp',
        severity: 'MEDIUM',
        sourceValue: change.source,
        targetValue: change.target,
        timeDifference: timeDiff,
        conflictWindow: window,
        priority: this.getConflictPriority(this.conflictTypes.TIMESTAMP_CONFLICT),
        autoResolvable: true,
        recommendedStrategy: 'USE_LATEST_TIMESTAMP',
        confidence: this.calculateConfidence('timestamp', change, source, target)
      }
    }

    return null
  }

  /**
   * 檢測一般欄位衝突
   * @param {string} field - 欄位名稱
   * @param {Object} change - 欄位變更
   * @param {Object} source - 源資料
   * @param {Object} target - 目標資料
   * @returns {Object|null} 衝突物件
   */
  detectGenericConflict (field, change, source, target) {
    if (change.severity === 'HIGH') {
      return {
        id: `generic_conflict_${field}_${Date.now()}`,
        type: this.conflictTypes.VALUE_INCONSISTENCY,
        field,
        severity: change.severity,
        sourceValue: change.source,
        targetValue: change.target,
        changeType: change.type,
        priority: this.getConflictPriority(this.conflictTypes.VALUE_INCONSISTENCY),
        autoResolvable: change.severity !== 'HIGH',
        recommendedStrategy: 'MANUAL_REVIEW',
        confidence: this.calculateConfidence(field, change, source, target)
      }
    }

    return null
  }

  /**
   * 計算字串相似度（重複使用 DataComparisonEngine 的邏輯）
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
   * 獲取衝突優先級分數
   * @param {string} conflictType - 衝突類型
   * @returns {number} 優先級分數
   */
  getConflictPriority (conflictType) {
    const priorities = {
      PROGRESS_MISMATCH: 8,
      TITLE_DIVERGENCE: 9,
      TIMESTAMP_CONFLICT: 3,
      DATA_TYPE_MISMATCH: 7,
      VALUE_INCONSISTENCY: 5,
      METADATA_CONFLICT: 4,
      COMPOSITE_CONFLICT: 10
    }

    return priorities[conflictType] || 1
  }

  /**
   * 計算衝突嚴重性
   * @param {Array} conflictItems - 衝突項目陣列
   * @returns {string} 嚴重性等級
   */
  calculateConflictSeverity (conflictItems) {
    if (conflictItems.length === 0) return this.severityLevels.NONE

    let totalScore = 0
    let totalConflicts = 0

    conflictItems.forEach(item => {
      item.conflicts.forEach(conflict => {
        const severityScore = this.getSeverityScore(conflict.severity)
        const priorityMultiplier = (conflict.priority || 5) / 10
        totalScore += severityScore * priorityMultiplier
        totalConflicts++
      })
    })

    if (totalConflicts === 0) return this.severityLevels.NONE

    const averageScore = totalScore / totalConflicts

    if (averageScore >= 10) return this.severityLevels.CRITICAL
    if (averageScore >= 6) return this.severityLevels.HIGH
    if (averageScore >= 3) return this.severityLevels.MEDIUM
    if (averageScore >= 1) return this.severityLevels.LOW

    return this.severityLevels.NONE
  }

  /**
   * 獲取嚴重性分數
   * @param {string} severity - 嚴重性等級
   * @returns {number} 分數
   */
  getSeverityScore (severity) {
    const scores = {
      CRITICAL: 20,
      HIGH: 15,
      MEDIUM: 10,
      LOW: 5,
      NONE: 0
    }

    return scores[severity] || 0
  }

  /**
   * 生成衝突解決建議
   * @param {Array} conflictItems - 衝突項目陣列
   * @returns {Array} 建議陣列
   */
  generateConflictRecommendations (conflictItems) {
    const recommendations = []

    conflictItems.forEach(item => {
      item.conflicts.forEach(conflict => {
        const recommendation = this.createSmartRecommendation(conflict)
        if (recommendation) {
          recommendations.push(recommendation)
        }
      })
    })

    // 處理大量衝突的情況
    if (conflictItems.length > 5) {
      recommendations.unshift({
        id: 'bulk_resolution',
        type: 'BULK_STRATEGY',
        strategy: 'BATCH_RESOLUTION',
        priority: 10,
        description: '建議使用批次解決策略處理大量衝突',
        autoResolvable: true,
        estimatedTime: this.estimateResolutionTime(conflictItems.flatMap(item => item.conflicts))
      })
    }

    return recommendations.sort((a, b) => b.priority - a.priority)
  }

  /**
   * 建立智能建議
   * @param {Object} conflict - 衝突物件
   * @returns {Object} 建議物件
   */
  createSmartRecommendation (conflict) {
    const baseRecommendation = {
      id: `rec_${conflict.id}`,
      conflictId: conflict.id,
      type: conflict.type,
      priority: conflict.priority,
      autoResolvable: conflict.autoResolvable,
      confidence: conflict.confidence
    }

    switch (conflict.type) {
      case this.conflictTypes.PROGRESS_MISMATCH:
        return {
          ...baseRecommendation,
          strategy: conflict.difference > 50 ? 'MANUAL_REVIEW' : 'USE_HIGHER_PROGRESS',
          description: `進度差異 ${conflict.difference}%，${conflict.autoResolvable ? '建議使用較高值' : '需要人工檢視'}`,
          estimatedTime: conflict.autoResolvable ? 100 : 1000
        }

      case this.conflictTypes.TITLE_DIVERGENCE:
        return {
          ...baseRecommendation,
          strategy: conflict.similarity > 0.6 ? 'USE_LONGER_TITLE' : 'MANUAL_REVIEW',
          description: `標題相似度 ${(conflict.similarity * 100).toFixed(1)}%，${conflict.autoResolvable ? '建議使用較長標題' : '需要人工檢視'}`,
          estimatedTime: conflict.autoResolvable ? 200 : 2000
        }

      case this.conflictTypes.TIMESTAMP_CONFLICT:
        return {
          ...baseRecommendation,
          strategy: 'USE_LATEST_TIMESTAMP',
          description: '時間戳衝突，建議使用最新時間',
          estimatedTime: 50
        }

      default:
        return {
          ...baseRecommendation,
          strategy: 'MANUAL_REVIEW',
          description: '需要人工檢視和處理',
          estimatedTime: 1500
        }
    }
  }

  /**
   * 計算複合衝突嚴重性
   * @param {Array} conflicts - 衝突陣列
   * @returns {string} 嚴重性等級
   */
  calculateCompositeSeverity (conflicts) {
    const severities = conflicts.map(c => c.severity)

    if (severities.includes('CRITICAL')) return 'CRITICAL'
    if (severities.includes('HIGH')) return 'HIGH'
    if (severities.includes('MEDIUM')) return 'MEDIUM'
    return 'LOW'
  }

  /**
   * 選擇複合衝突策略
   * @param {Array} conflicts - 衝突陣列
   * @returns {string} 策略名稱
   */
  selectCompositeStrategy (conflicts) {
    const hasManualReview = conflicts.some(c => c.recommendedStrategy === 'MANUAL_REVIEW')
    if (hasManualReview) return 'MANUAL_REVIEW'

    const hasHighPriority = conflicts.some(c => c.priority >= 8)
    if (hasHighPriority) return 'PRIORITIZED_RESOLUTION'

    return 'AUTOMATED_RESOLUTION'
  }

  /**
   * 判斷是否可自動解決
   * @param {Object} conflicts - 衝突物件
   * @returns {boolean} 是否可自動解決
   */
  isAutoResolvable (conflicts) {
    if (!this.config.autoResolveConflicts) return false
    if (conflicts.severity === 'CRITICAL') return false

    return conflicts.items.every(item =>
      item.conflicts.every(conflict => conflict.autoResolvable)
    )
  }

  /**
   * 估算解決時間
   * @param {Array} conflicts - 衝突陣列
   * @returns {number} 預估時間（毫秒）
   */
  estimateResolutionTime (conflicts) {
    const baseTime = conflicts.length * 500 // 每個衝突基本時間
    const complexityMultiplier = conflicts.filter(c => !c.autoResolvable).length * 2

    return baseTime * (1 + complexityMultiplier)
  }

  /**
   * 計算進度衝突嚴重性
   * @param {number} diff - 進度差異
   * @returns {string} 嚴重性等級
   */
  calculateProgressSeverity (diff) {
    if (diff >= 70) return 'CRITICAL'
    if (diff >= 50) return 'HIGH'
    if (diff >= 30) return 'MEDIUM'
    return 'LOW'
  }

  /**
   * 計算衝突檢測信心度
   * @param {string} field - 欄位名稱
   * @param {Object} change - 變更物件
   * @param {Object} source - 源資料
   * @param {Object} target - 目標資料
   * @returns {number} 信心度（0-1之間）
   */
  calculateConfidence (field, change, source, target) {
    // 基於欄位類型和變更類型計算信心度
    let confidence = 0.7 // 基礎信心度

    // 根據欄位類型調整
    if (field === 'progress' || field === 'timestamp') {
      confidence += 0.2 // 數值類型更可靠
    }

    // 根據變更類型調整
    if (change.type === 'VALUE_CHANGED') {
      confidence += 0.1
    }

    return Math.min(confidence, 1.0)
  }

  /**
   * 獲取衝突檢測統計
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
      totalConflictsDetected: 0,
      resolvedConflicts: 0,
      autoResolvedConflicts: 0,
      conflictsByType: {},
      averageResolutionTime: 0
    }

    // 重新初始化衝突類型統計
    Object.keys(this.conflictTypes).forEach(type => {
      this.stats.conflictsByType[type] = 0
    })
  }

  /**
   * 更新配置
   * @param {Object} newConfig - 新的配置
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
  module.exports = ConflictDetectionService
}

// 瀏覽器環境支援
if (typeof window !== 'undefined') {
  window.ConflictDetectionService = ConflictDetectionService
}
