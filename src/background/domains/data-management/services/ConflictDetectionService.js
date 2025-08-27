/**
 * ConflictDetectionService - 衝突檢測服務
 * 
 * 職責：
 * - 智能衝突檢測和分類功能
 * - 衝突嚴重性分析和優先級排序  
 * - 自動解決策略生成
 * - 批次衝突檢測和統計功能
 * 
 * TDD實作：根據測試驅動的最小可行實作
 */
class ConflictDetectionService {
  constructor(config = {}) {
    // 預設配置
    this.config = {
      progressConflictThreshold: 15,
      titleSimilarityThreshold: 0.8,
      timestampConflictWindow: 60000,
      enableIntelligentDetection: true,
      autoResolveConflicts: false,
      maxConflictsPerItem: 10,
      batchSize: 100,
      ...config
    }
    
    // 統計資料
    this.stats = {
      totalDetections: 0,
      conflictsFound: 0,
      conflictsResolved: 0,
      detectionTime: 0
    }
    
    this.isInitialized = true
  }

  /**
   * 檢測衝突
   * @param {Array} sourceData 源資料
   * @param {Array} targetData 目標資料
   * @param {Object} changes 變更資訊
   * @returns {Object} 衝突檢測結果
   */
  async detectConflicts(sourceData, targetData, changes = {}) {
    const startTime = performance.now()
    
    const conflicts = []
    let hasConflicts = false
    
    // 檢查修改項目的衝突
    if (changes.modified && changes.modified.length > 0) {
      for (const modification of changes.modified) {
        const itemConflicts = await this._analyzeItemConflicts(modification)
        if (itemConflicts.length > 0) {
          conflicts.push(...itemConflicts)
          hasConflicts = true
        }
      }
    }
    
    // 統計更新
    this.stats.totalDetections++
    if (hasConflicts) {
      this.stats.conflictsFound++
    }
    
    const detectionTime = performance.now() - startTime
    this.stats.detectionTime += detectionTime
    
    const result = {
      hasConflicts,
      conflicts,
      summary: {
        totalItems: sourceData.length + targetData.length,
        conflictItems: conflicts.length,
        conflictTypes: this._getConflictTypes(conflicts),
        highSeverityConflicts: conflicts.filter(c => c.severity === 'HIGH').length
      },
      detectionTime,
      timestamp: Date.now()
    }
    
    // 自動解決衝突（如果啟用）
    if (this.config.autoResolveConflicts && hasConflicts) {
      result.autoResolution = await this.autoResolveConflicts(result)
    }
    
    return result
  }

  /**
   * 分析項目衝突
   * @param {Object} modification 修改項目
   * @returns {Array} 衝突列表
   */
  async _analyzeItemConflicts(modification) {
    const conflicts = []
    const { id, fieldChanges } = modification
    
    if (!fieldChanges) return conflicts
    
    // 檢查進度衝突
    if (fieldChanges.progress) {
      const progressConflict = this._checkProgressConflict(id, fieldChanges.progress)
      if (progressConflict) {
        conflicts.push(progressConflict)
      }
    }
    
    // 檢查標題衝突
    if (fieldChanges.title) {
      const titleConflict = this._checkTitleConflict(id, fieldChanges.title)
      if (titleConflict) {
        conflicts.push(titleConflict)
      }
    }
    
    // 檢查時間戳衝突
    if (fieldChanges.lastUpdated) {
      const timestampConflict = this._checkTimestampConflict(id, fieldChanges.lastUpdated)
      if (timestampConflict) {
        conflicts.push(timestampConflict)
      }
    }
    
    return conflicts
  }

  /**
   * 檢查進度衝突
   * @param {string} itemId 項目ID
   * @param {Object} progressChange 進度變更
   * @returns {Object|null} 衝突物件或null
   */
  _checkProgressConflict(itemId, progressChange) {
    const { source, target } = progressChange
    const diff = Math.abs(source - target)
    
    if (diff >= this.config.progressConflictThreshold) {
      return {
        id: `conflict_${itemId}_progress`,
        itemId,
        type: 'PROGRESS_CONFLICT',
        field: 'progress',
        severity: diff >= 30 ? 'HIGH' : 'MEDIUM',
        sourceValue: source,
        targetValue: target,
        difference: diff,
        description: `進度差異過大: ${source}% vs ${target}% (差異: ${diff}%)`,
        resolutionStrategies: this._generateProgressResolutionStrategies(source, target)
      }
    }
    
    return null
  }

  /**
   * 檢查標題衝突
   * @param {string} itemId 項目ID
   * @param {Object} titleChange 標題變更
   * @returns {Object|null} 衝突物件或null
   */
  _checkTitleConflict(itemId, titleChange) {
    const { source, target } = titleChange
    const similarity = this._calculateStringSimilarity(source, target)
    
    if (similarity < this.config.titleSimilarityThreshold && source !== target) {
      return {
        id: `conflict_${itemId}_title`,
        itemId,
        type: 'TITLE_CONFLICT',
        field: 'title',
        severity: similarity < 0.5 ? 'HIGH' : 'MEDIUM',
        sourceValue: source,
        targetValue: target,
        similarity,
        description: `標題差異過大: "${source}" vs "${target}" (相似度: ${Math.round(similarity * 100)}%)`,
        resolutionStrategies: this._generateTitleResolutionStrategies(source, target, similarity)
      }
    }
    
    return null
  }

  /**
   * 檢查時間戳衝突
   * @param {string} itemId 項目ID
   * @param {Object} timestampChange 時間戳變更
   * @returns {Object|null} 衝突物件或null
   */
  _checkTimestampConflict(itemId, timestampChange) {
    const { source, target } = timestampChange
    
    // 簡化的時間戳衝突檢測
    const sourceTime = new Date(source).getTime()
    const targetTime = new Date(target).getTime()
    const timeDiff = Math.abs(sourceTime - targetTime)
    
    if (timeDiff > this.config.timestampConflictWindow) {
      return {
        id: `conflict_${itemId}_timestamp`,
        itemId,
        type: 'TIMESTAMP_CONFLICT',
        field: 'lastUpdated',
        severity: timeDiff > 24 * 60 * 60 * 1000 ? 'HIGH' : 'LOW', // 超過24小時為高嚴重性
        sourceValue: source,
        targetValue: target,
        timeDifference: timeDiff,
        description: `更新時間差異過大: ${source} vs ${target}`,
        resolutionStrategies: this._generateTimestampResolutionStrategies(source, target)
      }
    }
    
    return null
  }

  /**
   * 生成進度解決策略
   * @param {number} sourceProgress 源進度
   * @param {number} targetProgress 目標進度
   * @returns {Array} 解決策略列表
   */
  _generateProgressResolutionStrategies(sourceProgress, targetProgress) {
    const strategies = []
    
    // 取較高進度
    if (sourceProgress > targetProgress) {
      strategies.push({
        type: 'USE_HIGHER_PROGRESS',
        action: 'USE_SOURCE',
        value: sourceProgress,
        confidence: 0.8,
        description: '使用較高的進度值'
      })
    } else {
      strategies.push({
        type: 'USE_HIGHER_PROGRESS', 
        action: 'USE_TARGET',
        value: targetProgress,
        confidence: 0.8,
        description: '使用較高的進度值'
      })
    }
    
    // 平均值策略
    const average = Math.round((sourceProgress + targetProgress) / 2)
    strategies.push({
      type: 'USE_AVERAGE',
      action: 'CALCULATE_AVERAGE',
      value: average,
      confidence: 0.6,
      description: '使用平均進度值'
    })
    
    return strategies
  }

  /**
   * 生成標題解決策略
   * @param {string} sourceTitle 源標題
   * @param {string} targetTitle 目標標題
   * @param {number} similarity 相似度
   * @returns {Array} 解決策略列表
   */
  _generateTitleResolutionStrategies(sourceTitle, targetTitle, similarity) {
    const strategies = []
    
    // 使用較長的標題
    if (sourceTitle.length > targetTitle.length) {
      strategies.push({
        type: 'USE_LONGER_TITLE',
        action: 'USE_SOURCE',
        value: sourceTitle,
        confidence: 0.7,
        description: '使用較完整的標題'
      })
    } else {
      strategies.push({
        type: 'USE_LONGER_TITLE',
        action: 'USE_TARGET', 
        value: targetTitle,
        confidence: 0.7,
        description: '使用較完整的標題'
      })
    }
    
    // 手動選擇
    strategies.push({
      type: 'MANUAL_SELECTION',
      action: 'REQUIRE_USER_INPUT',
      options: [sourceTitle, targetTitle],
      confidence: 1.0,
      description: '需要手動選擇標題'
    })
    
    return strategies
  }

  /**
   * 生成時間戳解決策略
   * @param {string} sourceTimestamp 源時間戳
   * @param {string} targetTimestamp 目標時間戳
   * @returns {Array} 解決策略列表
   */
  _generateTimestampResolutionStrategies(sourceTimestamp, targetTimestamp) {
    const strategies = []
    
    const sourceTime = new Date(sourceTimestamp).getTime()
    const targetTime = new Date(targetTimestamp).getTime()
    
    // 使用較新的時間戳
    if (sourceTime > targetTime) {
      strategies.push({
        type: 'USE_NEWER_TIMESTAMP',
        action: 'USE_SOURCE',
        value: sourceTimestamp,
        confidence: 0.9,
        description: '使用較新的時間戳'
      })
    } else {
      strategies.push({
        type: 'USE_NEWER_TIMESTAMP',
        action: 'USE_TARGET',
        value: targetTimestamp,
        confidence: 0.9,
        description: '使用較新的時間戳'
      })
    }
    
    return strategies
  }

  /**
   * 自動解決衝突
   * @param {Object} conflictResult 衝突檢測結果
   * @returns {Object} 自動解決結果
   */
  async autoResolveConflicts(conflictResult) {
    const resolutions = []
    
    for (const conflict of conflictResult.conflicts) {
      // 選擇最高信心度的策略
      const bestStrategy = conflict.resolutionStrategies
        .sort((a, b) => b.confidence - a.confidence)[0]
      
      if (bestStrategy && bestStrategy.confidence >= 0.8) {
        resolutions.push({
          conflictId: conflict.id,
          strategy: bestStrategy,
          resolved: true,
          autoApplied: true
        })
        
        this.stats.conflictsResolved++
      }
    }
    
    return {
      totalConflicts: conflictResult.conflicts.length,
      autoResolved: resolutions.filter(r => r.resolved).length,
      resolutions
    }
  }

  /**
   * 批次檢測衝突
   * @param {Array} sourceData 源資料
   * @param {Array} targetData 目標資料  
   * @param {Object} options 選項
   * @returns {Object} 批次檢測結果
   */
  async batchDetectConflicts(sourceData, targetData, options = {}) {
    const batchSize = options.batchSize || this.config.batchSize
    const results = []
    
    // 簡化的批次處理
    for (let i = 0; i < Math.max(sourceData.length, targetData.length); i += batchSize) {
      const sourceBatch = sourceData.slice(i, i + batchSize)
      const targetBatch = targetData.slice(i, i + batchSize)
      
      const batchResult = await this.detectConflicts(sourceBatch, targetBatch)
      results.push(batchResult)
    }
    
    // 合併結果
    const mergedResult = this._mergeBatchResults(results)
    return mergedResult
  }

  /**
   * 合併批次結果
   * @param {Array} results 批次結果列表
   * @returns {Object} 合併的結果
   */
  _mergeBatchResults(results) {
    const allConflicts = results.flatMap(r => r.conflicts)
    
    return {
      hasConflicts: allConflicts.length > 0,
      conflicts: allConflicts,
      summary: {
        totalBatches: results.length,
        totalConflicts: allConflicts.length,
        conflictTypes: this._getConflictTypes(allConflicts)
      },
      batchResults: results
    }
  }

  /**
   * 獲取衝突類型統計
   * @param {Array} conflicts 衝突列表
   * @returns {Object} 衝突類型統計
   */
  _getConflictTypes(conflicts) {
    const types = {}
    for (const conflict of conflicts) {
      types[conflict.type] = (types[conflict.type] || 0) + 1
    }
    return types
  }

  /**
   * 計算字串相似度
   * @param {string} str1 第一個字串
   * @param {string} str2 第二個字串
   * @returns {number} 相似度 (0-1)
   */
  _calculateStringSimilarity(str1, str2) {
    if (str1 === str2) return 1
    if (!str1 || !str2) return 0
    
    // 簡單的相似度計算
    const longer = str1.length > str2.length ? str1 : str2
    const shorter = str1.length > str2.length ? str2 : str1
    
    if (longer.length === 0) return 1
    
    const editDistance = this._levenshteinDistance(longer, shorter)
    return (longer.length - editDistance) / longer.length
  }

  /**
   * 計算編輯距離
   * @param {string} str1 第一個字串
   * @param {string} str2 第二個字串
   * @returns {number} 編輯距離
   */
  _levenshteinDistance(str1, str2) {
    const matrix = Array(str2.length + 1).fill(null).map(() => Array(str1.length + 1).fill(null))
    
    for (let i = 0; i <= str1.length; i++) matrix[0][i] = i
    for (let j = 0; j <= str2.length; j++) matrix[j][0] = j
    
    for (let j = 1; j <= str2.length; j++) {
      for (let i = 1; i <= str1.length; i++) {
        const cost = str1[i - 1] === str2[j - 1] ? 0 : 1
        matrix[j][i] = Math.min(
          matrix[j - 1][i] + 1,
          matrix[j][i - 1] + 1,
          matrix[j - 1][i - 1] + cost
        )
      }
    }
    
    return matrix[str2.length][str1.length]
  }

  /**
   * 獲取統計資訊
   * @returns {Object} 統計資訊
   */
  getStatistics() {
    return {
      ...this.stats,
      config: this.config,
      timestamp: Date.now()
    }
  }

  /**
   * 重置統計
   */
  resetStatistics() {
    this.stats = {
      totalDetections: 0,
      conflictsFound: 0,
      conflictsResolved: 0,
      detectionTime: 0
    }
  }

  /**
   * 更新配置
   * @param {Object} newConfig 新配置
   */
  updateConfig(newConfig) {
    this.config = { ...this.config, ...newConfig }
  }
}

module.exports = ConflictDetectionService